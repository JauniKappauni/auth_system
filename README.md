# Auth System

Create a `.env` file

```
DB_HOST=
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
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);
```

# ToDo's

- Add password confirmation in registration form
- validate password strength (min length, symbols, etc.)
- Hashing of Passwords
- Automatic Clear of reset_token and reset_expires
- Add change password option for logged-in users
- Add Rate Limiting (failed login attempts)
- Add edit/update user feature in admin panel
- Add pagination or search for users, if many users exist
- Add ability to promote/demote users
- Use HTML email templates for reset email
- Add verification email on registration
- Show alert for actions (e.g. User deleted, Password reset sent) instead of blank html
- Design overall so frontend with frameworks
- Responsive Layout
- Sanitize all user input(XSS prevention)
- Add CSRF protection for forms
- HTTPS (SSL Certificates)
- Reverse Proxy
- Store session securely with cookie flags(secure, httpOnly, sameSite)
- Add static parameters to .env and remove in code
- Logs
- Change Project Structure (e.g. move routes in separate files)
- Add header and footer to ejs files
