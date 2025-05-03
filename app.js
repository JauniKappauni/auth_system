const express = require("express");
const session = require("express-session");
const env = require("dotenv");
require("dotenv").config();
const mysql = require("mysql2");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const app = express();
const port = 3000;

const dbhost = process.env.DB_HOST;
const dbuser = process.env.DB_USER;
const dbpassword = process.env.DB_PASSWORD;
const dbname = process.env.DB_NAME;

const mailhost = process.env.MAIL_HOST;
const mailuser = process.env.MAIL_USER;
const mailpassword = process.env.MAIL_PASSWORD;

const conn = mysql.createConnection({
  host: dbhost,
  user: dbuser,
  password: dbpassword,
  database: dbname,
});
conn.connect(() => {
  console.log("Connection to the database successful");
});

app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index", { title: "Home" });
});

app.get("/register", (req, res) => {
  res.render("register", { title: "Register" });
});

app.get("/login", (req, res) => {
  res.render("login", { title: "Login" });
});

app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  res.render("dashboard", { title: "Dashboard", user: req.session.user });
});

app.post("/register", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  conn.query(
    "INSERT INTO users (email, password) VALUES (?,?)",
    [email, password],
    (err, results) => {
      if (err) {
        console.error(err);
        res.send("There was a problem with your registration");
      } else {
        console.log("Sucessfully registered");
        req.session.user = { id: results.insertId, email };
        res.redirect("/dashboard");
      }
    }
  );
});

app.post("/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  conn.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error(err);
      res.send("No email found in the database");
    }
    if (results.length == 0) {
      res.send("email not found");
    } else if (results[0].password == password) {
      console.log("Sucessfully logged in");
      req.session.user = { id: results[0].id, email };
      res.redirect("/dashboard");
    } else {
      res.send("Wrong password");
    }
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/forgot-password", (req, res) => {
  res.render("forgot-password", { title: "Forgot Password" });
});

app.post("/forgot-password", (req, res) => {
  const emailvalue = req.body.email;
  conn.query(
    "SELECT * FROM users WHERE email = ?",
    [emailvalue],
    (err, results) => {
      if (err) {
        console.error(err);
        res.send("No email found in the database");
      }
      if (results.length == 0) {
        res.send("email not found");
      } else {
        const reset_token = crypto.randomBytes(32).toString("hex");
        const reset_expires = new Date(Date.now() + 3600000);
        conn.query(
          "UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?",
          [reset_token, reset_expires, emailvalue],
          (err2) => {
            if (err) {
              console.error(err2);
              res.send("No email found in the database");
            } else {
              const transporter = nodemailer.createTransport({
                host: `${mailhost}`,
                port: 465,
                secure: true,
                auth: {
                  user: `${mailuser}`,
                  pass: `${mailpassword}`,
                },
              });

              async function email() {
                const info = await transporter.sendMail({
                  from: `Jauni.de - Mail System" ${mailuser}`,
                  to: `${emailvalue}`,
                  subject: "Hello ✔",
                  text: "Hello world?",
                  html: `<a href=http://localhost:3000/reset-password?token=${reset_token}>Reset Password</a>`,
                });

                console.log("Message sent: %s", info.messageId);
              }

              email().catch(console.error);
              res.send("Check your email");
            }
          }
        );
      }
    }
  );
});

app.get("/reset-password", (req, res) => {
  const reset_token = req.query.token;
  if (!reset_token) {
    return res.send("token is missing");
  } else {
    res.render("reset-password", {
      title: "Reset Password",
      token: reset_token,
    });
  }
});
app.post("/reset-password", (req, res) => {
  const reset_token = req.body.token;
  const newPassword = req.body.password;
  conn.query(
    "SELECT * FROM users WHERE reset_token = ?",
    [reset_token],
    (err, results) => {
      if (err) {
        console.error(err);
        res.send("No token found in the database");
      }
      if (results.length == 0) {
        res.send("token not found");
      } else {
        const expirationDate = new Date(results[0].token_expires);
        if (expirationDate.getTime() < Date.now()) {
          res.send("Token expired");
        } else {
          conn.query(
            "UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE reset_token = ?",
            [newPassword, reset_token],
            (err2) => {
              if (err2) {
                console.error(err2);
                return res.send("Error updating password");
              } else {
                res.send("Passwort successfully changed");
              }
            }
          );
        }
      }
    }
  );
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
