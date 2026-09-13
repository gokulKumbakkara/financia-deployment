# Financia — Deployment

*Deployable build of the Financia personal finance dashboard — a FastAPI + SQLite backend with a per-month data management system.*

This repository packages the Financia dashboard for deployment: it tracks salary, savings, debts, family expenses, overall savings, reminders, and notes on a fully independent per-month basis.

## Features

- Per-month data management system, allowing independent tracking of financial data for each month
- Tracking of salary, savings, debts, family expenses, overall savings, reminders, and notes
- Debounced save functionality so data is saved to the API in a timely and efficient manner
- Automatic migration of old `carryForward` data to the new data shape
- Dynamic calculation of month labels and navigation

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript, HTML, CSS (no framework) |
| Backend | FastAPI |
| Database | SQLite / PostgreSQL (`psycopg2-binary`) |
| Auth | `python-jose[cryptography]` (JWT) |

Dependencies (`requirements.txt`): `fastapi`, `uvicorn`, `pydantic`, `psycopg2-binary`, `python-jose[cryptography]`.

## Getting Started

### Prerequisites

- Python 3.x
- pip

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/gokulKumbakkara/financia-deployment.git
   ```
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Launch the application:
   ```bash
   ./launch-financia.sh
   # or double-click "Launch Financia.command" on macOS
   ```

## Usage

Launch the application and navigate to the dashboard in your web browser. From there, you can view and edit your financial data for each month, including salary, savings, debts, family expenses, overall savings, reminders, and notes.

## Project Structure

- `app.js` — the entry point of the application
- `backend/` — the FastAPI backend (`main.py`, `requirements.txt`)
- `index.html` — the main HTML file for the dashboard
- `login.html` — the login page for the dashboard
- `styles.css` — the CSS styles for the dashboard

## Contributing

To contribute to the Financia dashboard, please follow these steps:
1. Fork the repository
2. Make your changes and commit them
3. Push your changes to your fork
4. Submit a pull request to the main repository

Please ensure that your changes are consistent with the existing code style and functionality, and that you have tested your changes thoroughly before submitting a pull request.
