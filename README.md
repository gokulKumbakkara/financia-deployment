# Financia — Personal Finance Dashboard
Financia is a personal finance dashboard that provides a fully independent per-month data management system, backed by FastAPI and SQLite. It allows users to track their financial data, including salary, savings, debts, family expenses, overall savings, reminders, and notes.

## Features
* Per-month data management system, allowing for independent tracking of financial data for each month
* Support for tracking salary, savings, debts, family expenses, overall savings, reminders, and notes
* Debounced save functionality to ensure data is saved to the API in a timely and efficient manner
* Automatic migration of old carryForward data to the new data shape
* Dynamic calculation of month labels and navigation

## Tech Stack
* Frontend: JavaScript
* Backend: FastAPI, SQLite
* Dependencies: fastapi, uvicorn, pydantic, psycopg2-binary, python-jose[cryptography]

## Installation
To install the Financia dashboard, follow these steps:
1. Clone the repository using `git clone`
2. Install the required dependencies using `pip install -r requirements.txt`
3. Launch the application using `Launch Financia.command` or `launch-financia.sh`

## Usage
To use the Financia dashboard, simply launch the application and navigate to the dashboard in your web browser. From there, you can view and edit your financial data for each month, including salary, savings, debts, family expenses, overall savings, reminders, and notes.

## Folder Structure
The repository is organized into the following folders and files:
* `app.js`: The entry point of the application
* `backend`: The backend API code
* `index.html`: The main HTML file for the dashboard
* `login.html`: The login page for the dashboard
* `styles.css`: The CSS styles for the dashboard
* `requirements.txt`: The list of dependencies required to run the application

## Contributing
To contribute to the Financia dashboard, please follow these steps:
1. Fork the repository using `git fork`
2. Make your changes and commit them using `git commit`
3. Push your changes to your fork using `git push`
4. Submit a pull request to the main repository
Please ensure that your changes are consistent with the existing code style and functionality, and that you have tested your changes thoroughly before submitting a pull request.