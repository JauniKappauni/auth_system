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
