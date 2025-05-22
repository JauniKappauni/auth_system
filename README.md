# Auth System

Create a `.env` file

```
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=
SESSION_SECRET=
MAIL_HOST=
MAIL_USER=
MAIL_PASSWORD=
```

Create a `mysql or mariadb` database

```
CREATE DATABASE IF NOT EXISTS auth_system;

USE auth_system;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
	reset_token VARCHAR(255),
	reset_expires DATETIME,
	role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    new_email VARCHAR(255),
    email_change_token VARCHAR(64)
);

CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    category VARCHAR(255),
    status BOOLEAN,
    created_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT,
    user_id INT,
    message TEXT,
    created_at DATETIME,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```
If you use Pterodactyl, you have to make sure to create the root user for external networking with all privileges
```
CREATE USER 'root'@'%' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```
You can give yourself the administrator role
```
UPDATE users 
SET role = 'admin' 
WHERE email = 'specific_user@example.com';
```

# ToDo's

- Add password confirmation in registration form
- Validate password strength (min length, symbols, etc.)
- Hashing of Passwords
- Add Rate Limiting (failed login attempts)
- Add edit/update user feature in admin panel
- Add pagination or search for users, if many users exist
- Add ability to promote/demote users
- Use HTML email templates for reset email
- Add verification email on registration
- Sanitize all user input(XSS prevention)
- Add CSRF protection for forms
- HTTPS (SSL Certificates)
- Reverse Proxy
- Store session securely with cookie flags(secure, httpOnly, sameSite)
- Logs
- Change Project Structure (e.g. move routes in separate files)