#!/bin/bash
# ─────────────────────────────────────────────
#  Financia — Double-click to launch!
#  Starts FastAPI server + opens the app in browser
# ─────────────────────────────────────────────

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"

if [ ! -f "$BACKEND_DIR/main.py" ]; then
  echo "❌ Error: backend/main.py not found in $BACKEND_DIR"
  read -p "Press Enter to close..."
  exit 1
fi

# Install dependencies if needed
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "📦 Installing dependencies..."
  pip3 install -r "$BACKEND_DIR/requirements.txt"
fi

# Kill any previous Financia server on port 8000
lsof -ti:8000 | xargs kill -9 2>/dev/null

echo "🚀 Starting Financia server..."
cd "$BACKEND_DIR"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Open in browser
echo "🌐 Opening Financia in your browser..."
open "http://localhost:8000"

echo "✅ Financia is running at http://localhost:8000"
echo "   Close this window or press Ctrl+C to stop the server."

# Trap to kill the server on exit
trap "echo '🛑 Stopping server...'; kill $SERVER_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

# Keep alive
wait $SERVER_PID
