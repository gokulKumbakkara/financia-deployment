"""
Financia — FastAPI Backend
Supports PostgreSQL (via DATABASE_URL) with SQLite fallback for local dev.
Includes password-based authentication with JWT cookies.
"""

import json
import os
import sqlite3
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response, Depends, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from jose import jwt, JWTError

# ── Config ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent
DATABASE_URL = os.environ.get("DATABASE_URL", "")
FINANCIA_PASSWORD = os.environ.get("FINANCIA_PASSWORD", "financia")  # default for local dev
SECRET_KEY = os.environ.get("SECRET_KEY", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

# ── Database ───────────────────────────────────────────
USE_PG = DATABASE_URL.startswith("postgres")

if USE_PG:
    import psycopg2
    import psycopg2.extras
    # Render uses postgres:// but psycopg2 needs postgresql://
    _pg_url = DATABASE_URL.replace("postgres://", "postgresql://", 1)


def init_db():
    if USE_PG:
        conn = psycopg2.connect(_pg_url)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS months (
                month_key TEXT PRIMARY KEY,
                data TEXT NOT NULL DEFAULT '{}'
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
    else:
        with get_sqlite() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS months (
                    month_key TEXT PRIMARY KEY,
                    data TEXT NOT NULL DEFAULT '{}'
                )
            """)
            conn.commit()


@contextmanager
def get_sqlite():
    db_path = BASE_DIR / "financia.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_db():
    if USE_PG:
        conn = psycopg2.connect(_pg_url)
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            yield conn, cur
        finally:
            cur.close()
            conn.close()
    else:
        conn = sqlite3.connect(str(BASE_DIR / "financia.db"))
        conn.execute("PRAGMA journal_mode=WAL")
        conn.row_factory = sqlite3.Row
        try:
            yield conn, conn
        finally:
            conn.close()


# ── Auth Helpers ───────────────────────────────────────

def create_token():
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode({"exp": expire, "sub": "financia_user"}, SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> bool:
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return True
    except JWTError:
        return False


# ── Pydantic Models ───────────────────────────────────

class MonthData(BaseModel):
    salary: float = 0
    savings: list[Any] = []
    debts: list[Any] = []
    family: list[Any] = []
    overallSavings: list[Any] = []
    reminders: list[Any] = []
    notes: str = ""

    class Config:
        extra = "allow"


class LoginRequest(BaseModel):
    password: str


# ── FastAPI App ────────────────────────────────────────

app = FastAPI(title="Financia API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth Routes ────────────────────────────────────────

@app.get("/login")
def serve_login():
    return FileResponse(FRONTEND_DIR / "login.html")


@app.post("/api/login")
def login(req: LoginRequest, response: Response):
    if req.password != FINANCIA_PASSWORD:
        raise HTTPException(status_code=401, detail="Wrong password")
    token = create_token()
    response.set_cookie(
        key="financia_token",
        value=token,
        httponly=True,
        max_age=JWT_EXPIRE_DAYS * 86400,
        samesite="lax",
        secure=False,  # set True if using HTTPS in production
    )
    return {"status": "ok"}


@app.get("/api/logout")
def logout(response: Response):
    response.delete_cookie("financia_token")
    return {"status": "ok"}


@app.get("/api/check")
def check_auth(financia_token: str = Cookie(default=None)):
    """Quick auth check for the frontend."""
    if not financia_token or not verify_token(financia_token):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"status": "ok"}


# ── Protected API Routes ──────────────────────────────

def require_auth(financia_token: str = Cookie(default=None)):
    if not financia_token or not verify_token(financia_token):
        raise HTTPException(status_code=401, detail="Not authenticated")


@app.get("/api/months")
def get_all_months(_=Depends(require_auth)):
    with get_db() as (conn, cur):
        if USE_PG:
            cur.execute("SELECT month_key, data FROM months")
            rows = cur.fetchall()
        else:
            rows = cur.execute("SELECT month_key, data FROM months").fetchall()
    months = {}
    for row in rows:
        try:
            months[row["month_key"]] = json.loads(row["data"])
        except (json.JSONDecodeError, KeyError):
            months[row["month_key"]] = {}
    return {"months": months}


@app.get("/api/months/{month_key}")
def get_month(month_key: str, _=Depends(require_auth)):
    with get_db() as (conn, cur):
        if USE_PG:
            cur.execute("SELECT data FROM months WHERE month_key = %s", (month_key,))
            row = cur.fetchone()
        else:
            row = cur.execute("SELECT data FROM months WHERE month_key = ?", (month_key,)).fetchone()
    if not row:
        return MonthData().model_dump()
    try:
        return json.loads(row["data"])
    except (json.JSONDecodeError, KeyError):
        return MonthData().model_dump()


@app.put("/api/months/{month_key}")
def put_month(month_key: str, month_data: MonthData, _=Depends(require_auth)):
    data_json = json.dumps(month_data.model_dump(), ensure_ascii=False)
    with get_db() as (conn, cur):
        if USE_PG:
            cur.execute(
                """INSERT INTO months (month_key, data) VALUES (%s, %s)
                   ON CONFLICT (month_key) DO UPDATE SET data = EXCLUDED.data""",
                (month_key, data_json),
            )
        else:
            cur.execute(
                """INSERT INTO months (month_key, data) VALUES (?, ?)
                   ON CONFLICT(month_key) DO UPDATE SET data = excluded.data""",
                (month_key, data_json),
            )
        conn.commit()
    return {"status": "ok", "month_key": month_key}


# ── Serve Frontend ─────────────────────────────────────

@app.get("/")
def serve_index(financia_token: str = Cookie(default=None)):
    if not financia_token or not verify_token(financia_token):
        return RedirectResponse(url="/login")
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


# ── Startup ────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    init_db()
    db_type = "PostgreSQL" if USE_PG else "SQLite"
    print(f"✅ Financia started — using {db_type}")


if __name__ == "__main__":
    import uvicorn
    init_db()
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
