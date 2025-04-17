# MentorNook

## Overview

MentorNook is a full-stack web application designed as a mentorship matching platform. It allows users to register as either mentors or mentees, create detailed profiles highlighting their skills and interests, browse other users, and establish mentorship connections.

This project features a vanilla JavaScript, HTML, and CSS frontend that communicates with a robust backend API built using Django and Django REST Framework, powered by a PostgreSQL database.

## Features

* **User Authentication:** Secure user registration, login, and logout functionality.
* **Profile Management:** Users can create, view, edit, and delete their profiles.
    * Specify role (Mentor or Mentee).
    * Add headline, bio, skills, interests, location, and external links.
    * Upload a profile picture.
* **User Discovery:**
    * Browse a list of other registered users (excluding oneself).
    * Filter users by role (Mentor/Mentee).
    * Filter users by skills and interests (using tag-based input).
    * Search users by name or keywords in their bio/headline.
    * Paginated results.
* **Connection Management:**
    * Send mentorship requests to other users.
    * View incoming and outgoing pending requests.
    * Accept or decline incoming requests.
    * Cancel outgoing requests.
    * View current established connections (mentors/mentees).
    * Remove existing connections.

## Technologies Used

**Frontend:**

* HTML5
* CSS3 (including Flexbox/Grid, CSS Variables)
* Vanilla JavaScript (ES6+) (DOM Manipulation, Fetch API for backend communication)

**Backend:**

* Python 3
* Django
* Django REST Framework (DRF)
* PostgreSQL (Database)
* `psycopg2-binary` (or `psycopg2`) (PostgreSQL adapter)
