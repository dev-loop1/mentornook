# MentorNook

## Overview

MentorNook is a full-stack web application designed as a mentorship matching platform. It allows users to register as either mentors or mentees, create detailed profiles highlighting their skills and interests, browse other users, and establish mentorship connections.

This project features a vanilla JavaScript, HTML, and CSS frontend that communicates with a robust backend API built using Django and Django REST Framework, powered by a PostgreSQL database.

## Live Demo

* **Frontend:** [https://mentornook.netlify.app/](https://mentornook.netlify.app/)
* **Backend API Root:** [https://mentornook.onrender.com/api](https://mentornook.onrender.com/api)

## Features

* **User Authentication:** Secure user registration, login, and logout functionality.
* **Profile Management:** Users can create, view, edit, and delete their profiles.
    * Specify role (Mentor or Mentee).
    * Add headline, bio, skills, interests, location, and external links.
    * Upload a profile picture (served via cloud storage or similar in production).
* **User Discovery:**
    * Browse a list of other registered users (excluding oneself).
    * Filter users by role, skills, and interests.
    * Search users by name or keywords.
    * Paginated results.
* **Connection Management:**
    * Send, accept, decline, cancel, or remove mentorship requests/connections.
    * View incoming/outgoing requests and current connections.

## Technologies Used

**Frontend:**

* HTML5
* CSS3 (Flexbox/Grid, CSS Variables)
* Vanilla JavaScript (ES6+)

**Backend:**

* Python 3
* Django & Django REST Framework (DRF)
* PostgreSQL
* Gunicorn (WSGI Server)
* `django-cors-headers`
* `django-filter`
* `psycopg2` (or `-binary`)
* `whitenoise` (for static files)
* `dj-database-url` (for DB config)
* `python-dotenv` (for local env vars)

## Local Setup and Running

**Prerequisites:**

* Python 3.x
* pip
* PostgreSQL Server
* Git

**Steps:**

1.  **Clone Repository:**
    ```bash
    git clone https://github.com/dev-loop1/mentornook.git
    cd mentornook-project
    ```

2.  **Setup Backend:**
    * Create and activate a virtual environment:
        ```bash
        python -m venv venv
        source venv/bin/activate # (or .\venv\Scripts\activate on Windows)
        ```
    * Install backend dependencies:
        ```bash
        cd backend
        pip install -r requirements.txt
        ```
    * Setup PostgreSQL database and user (see PostgreSQL docs).
    * Create a `.env` file in the `backend/` directory based on `.env.example` (if provided) or manually add variables:
        ```dotenv
        # backend/.env
        SECRET_KEY='your_local_secret_key'
        DEBUG=True
        DATABASE_URL='postgres://USER:PASSWORD@HOST:PORT/DB_NAME' # Your local DB URL
        ALLOWED_HOSTS=localhost,127.0.0.1
        CORS_ALLOWED_ORIGINS=http://localhost:5500,[http://127.0.0.1:5500](http://127.0.0.1:5500)
        ```
    * Run database migrations:
        ```bash
        python manage.py makemigrations api
        python manage.py migrate
        ```
    * Create a superuser (optional, for `/admin/`):
        ```bash
        python manage.py createsuperuser
        ```

3.  **Run Backend Server:**
    ```bash
    # Still inside backend/ directory
    python manage.py runserver
    ```
    *(Backend API typically runs at `http://127.0.0.1:8000/api/`)*

4.  **Run Frontend Server:**
    * Navigate to the `frontend/` directory in a **separate terminal**.
    * Use a simple HTTP server or VS Code's "Live Server" extension:
        * Right-click `frontend/index.html` -> "Open with Live Server".
    * *(Frontend typically runs at `http://127.0.0.1:5500/frontend/`)*
    * Ensure `API_BASE_URL` in `frontend/js/utils.js` points to `http://127.0.0.1:8000/api` for local development.

5.  **Access:** Open the frontend URL (e.g., `http://127.0.0.1:5500/frontend/`) in your browser.

## Deployment

* The backend is deployed on **Render** using Gunicorn and PostgreSQL. Static files (admin) are served via Whitenoise. Media files (user uploads) require a separate production solution (e.g., AWS S3, not included in this basic setup).
* The frontend is deployed as a static site on **Netlify**.
* Production environment variables (`SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `DEBUG=False`, etc.) are configured directly on the respective hosting platforms.

