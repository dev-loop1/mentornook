# MentorNook

## Overview

MentorNook is a full-stack web application designed as a mentorship matching platform. It allows users to register as either mentors or mentees, create detailed profiles highlighting their skills and interests, browse other users, and establish mentorship connections.

This project features a vanilla JavaScript, HTML, and CSS frontend that communicates with a robust backend API built using TypeScript, Fastify, and Prisma, powered by a PostgreSQL database.

## Live Demo

* **Frontend:** [https://mentornook.netlify.app/](https://mentornook.netlify.app/)
* **Backend API Root:** [https://mentornook.onrender.com/api](https://mentornook.onrender.com/api)

## Features

* **User Authentication:** Secure user registration, login, and logout functionality using JWT.
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

* Node.js & TypeScript
* Fastify
* Prisma ORM
* PostgreSQL
* Redis (for caching & rate limiting)
* JWT for Authentication

## Local Setup and Running

**Prerequisites:**

* Node.js (v18+)
* npm or yarn
* Docker & Docker Compose (for the PostgreSQL database)
* Git

**Steps:**

1.  **Clone Repository:**
    ```bash
    git clone https://github.com/dev-loop1/mentornook.git
    cd mentornook
    ```

2.  **Setup Backend:**
    * Navigate to the backend directory:
        ```bash
        cd backend-ts
        ```
    * Install backend dependencies:
        ```bash
        npm install
        ```
    * Start the PostgreSQL database using Docker Compose:
        ```bash
        docker compose up -d db
        ```
    * Create a `.env` file in the `backend-ts/` directory (you can copy from a `.env.example` if available) and add your environment variables:
        ```dotenv
        # backend-ts/.env
        DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mentornook_db?schema=public"
        JWT_SECRET="your_local_secret_key"
        ```
    * Push the Prisma schema to the database:
        ```bash
        npx prisma db push
        ```

3.  **Run Backend Server:**
    ```bash
    # Still inside backend-ts/ directory
    npm run dev
    ```
    *(The backend API will run at `http://127.0.0.1:3000/api`)*

4.  **Run Frontend Server:**
    * Navigate to the `frontend/` directory in a **separate terminal**.
    * Start a simple HTTP server. For example, using `npx`:
        ```bash
        npx http-server -p 8080
        ```
    * *(The frontend will run at `http://127.0.0.1:8080/`)*
    * **Note:** Ensure `API_BASE_URL` in `frontend/js/utils.js` and `frontend/js/utils.min.js` points to `http://localhost:3000/api` for local development.

5.  **Access:** Open the frontend URL (e.g., `http://127.0.0.1:8080/`) in your browser to view the application.

## Deployment

* The backend is designed to be deployed on platforms like **Render** or **Heroku** using Node.js and PostgreSQL.
* The frontend is deployed as a static site on **Netlify**.
* Production environment variables (`JWT_SECRET`, `DATABASE_URL`, etc.) should be configured directly on the respective hosting platforms.
