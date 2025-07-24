#  CRM & Ticketing System

This is a comprehensive CRM and Asset Management system with a fully integrated email-based ticketing system. It is designed to be a central hub for managing company information, tracking assets, and handling customer support requests efficiently.

The application features a secure Node.js backend with a MySQL database and a dynamic, responsive React frontend with a modern "glassmorphism" UI.

## Key Features

* **Company & Asset Management (CRM):**
    * Add, edit, and delete company profiles.
    * Track detailed information for each asset, including serial numbers, status, and location.
    * Import and export asset lists via Excel for bulk management.
* **Email-Integrated Ticketing System:**
    * **Automatic Ticket Creation:** Tickets are automatically created when an email is sent to a designated support address (e.g., `ruan@fastit.co.za`).
    * **Email Communication:** All replies and updates made within the app are automatically emailed to the customer. Customers can also reply directly to these emails to update their tickets.
    * **Automated Notifications:** Customers receive automatic email notifications for key events, including:
        * New ticket creation.
        * Changes in ticket status, priority, or technician assignment.
        * A full summary report when a ticket is closed.
* **Modern User Interface:**
    * A sleek "glassmorphism" design with frosted glass panels and an interactive "aurora" background that follows the user's cursor.
    * A theme toggle for switching between light and dark modes.
    * A fully responsive design that works on all screen sizes.
* **User & Security Management:**
    * JWT-based authentication to secure all API endpoints.
    * Role-based access control (Admin vs. User).
    * An admin panel for creating and managing user accounts.
    * Secure password hashing using `bcrypt`.
    * All sensitive credentials are managed securely using environment variables.

## Technologies Used

* **Backend:** Node.js, Express.js
* **Frontend:** React (Create React App)
* **Database:** MySQL
* **Styling:** Tailwind CSS
* **Email:** Nodemailer, SendGrid
* **Authentication:** JSON Web Tokens (JWT)

## Project Setup & Installation

To get the application running locally, you will need to set up both the backend and the frontend.

### Prerequisites

* Node.js and npm
* A running MySQL server

### 1. Backend Setup

1.  **Navigate to the backend directory** and install the necessary dependencies:

    ```bash
    npm install
    ```

2.  **Set up the database:**
    * Connect to your MySQL server.
    * Create a new database named `fast_it_assets`.
    * Run the necessary SQL scripts to create the `users`, `companies`, `assets`, and `tickets` tables.

3.  **Create the environment file:**
    * In the root of the backend directory, create a file named `.env`.
    * Add the following variables to this file, replacing the placeholder values with your own:

        ```
        JWT_SECRET="your_long_random_jwt_secret_key"
        DB_PASSWORD="your_database_password"
        SENDGRID_API_KEY="your_sendgrid_api_key"
        ```

4.  **Generate SSL Certificates:** For the HTTPS server to run locally, you will need self-signed certificates. If you don't have them, you can generate them using OpenSSL.

5.  **Start the server:**

    ```bash
    node server.js
    ```

    The server should now be running on `https://localhost:3001`.

### 2. Frontend Setup

1.  **Navigate to the `asset-register-ui` directory** and install its dependencies:

    ```bash
    npm install
    ```

2.  **Configure Tailwind CSS:** Ensure your `tailwind.config.js` file is set up for dark mode:

    ```javascript
    module.exports = {
      darkMode: 'class',
      // ... other configurations
    }
    ```

3.  **Start the development server:**

    ```bash
    npm start
    ```

    The application should now be accessible at `https://localhost:3000`. You may need to accept the self-signed certificate in your browser to proceed.

### 3. Production Build

When you are ready to deploy, run the following command in the `ui` directory:

```bash
npm run build
