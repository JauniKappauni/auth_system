const express = require("express");
const session = require("express-session");
const env = require("dotenv");
require("dotenv").config();
const mysql = require("mysql2");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const flash = require("express-flash");
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
conn.connect((err, res) => {
  if (err) {
    console.error("❌DB CONN", err);
  } else {
    console.log("✅DB CONN", res);
  }
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
app.use(express.static("public"));
app.use(flash());

app.get("/", (req, res) => {
  const user = req.session.user || null;
  const successMessages = req.flash("success");
  const errorMessages = req.flash("error");
  res.render("index", {
    title: "Home",
    user: user,
    successMessages: successMessages,
    errorMessages: errorMessages,
  });
});

app.get("/register", (req, res) => {
  res.render("register", { title: "Register" });
});

app.get("/login", (req, res) => {
  const successMessages = req.flash("success");
  const errorMessages = req.flash("error");
  res.render("login", {
    title: "Login",
    successMessages: successMessages,
    errorMessages: errorMessages,
  });
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
  const role = "user";
  conn.query(
    "INSERT INTO users (email, password, role) VALUES (?,?,?)",
    [email, password, role],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.send("There was a problem with your registration");
      } else {
        console.log(`✅ Registration by ${role} ${email} with ${password}`);
        req.session.user = { id: results.insertId, email, role };
        return res.redirect("/dashboard");
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
      return res.send("No email found in the database");
    }
    if (results.length == 0) {
      req.flash("error", "Email not found");
      return res.redirect("/login");
    } else if (results[0].password == password) {
      console.log(
        `✅ Login by ${results[0].role} ${results[0].email} with ${results[0].password}`
      );
      req.session.user = { id: results[0].id, email, role: results[0].role };
      return res.redirect("/dashboard");
    } else {
      console.log(
        `❌ Login by ${results[0].role} ${results[0].email} with ${password} instead of ${results[0].password}`
      );
      req.flash("error", "Wrong password");
      return res.redirect("/login");
    }
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    return res.redirect("/");
  });
});

app.get("/forgot-password", (req, res) => {
  const user = req.session.user || null;
  const successMessages = req.flash("success");
  const errorMessages = req.flash("error");
  res.render("forgot-password", {
    title: "Forgot Password",
    user: user,
    successMessages: successMessages,
    errorMessages: errorMessages,
  });
});

app.post("/forgot-password", (req, res) => {
  const emailvalue = req.body.email;
  conn.query(
    "SELECT * FROM users WHERE email = ?",
    [emailvalue],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.send("No email found in the database");
      }
      if (results.length == 0) {
        req.flash("error", "email not found");
        return res.redirect("/forgot-password");
      } else {
        const reset_token = crypto.randomBytes(32).toString("hex");
        const reset_expires = new Date(Date.now() + 3600000);
        conn.query(
          "UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?",
          [reset_token, reset_expires, emailvalue],
          (err2) => {
            if (err) {
              console.error(err2);
              return res.send("No email found in the database");
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
                  from: `"Jauni.de - Mail System" <${mailuser}>`,
                  to: `${emailvalue}`,
                  subject: "Password Reset",
                  text: `Activate html to see relevant content`,
                  html: `
                  <p>Here's the link to reset your password:</p>
                  <p><a href="http://localhost:3000/reset-password?token=${reset_token}">Reset Password</a></p>
                  <p>This Link is valid until: ${reset_expires}</p>
                  `,
                });

                console.log("Message sent: %s", info.messageId);
              }

              email().catch(console.error);
              req.flash("success", "Check your inbox");
              return res.redirect("/forgot-password");
            }
          }
        );
      }
    }
  );
});

app.get("/reset-password", (req, res) => {
  const user = req.session.user || null;
  const successMessages = req.flash("success");
  const errorMessages = req.flash("error");
  const reset_token = req.query.token;
  if (!reset_token) {
    req.flash("error", "token is missing");
    return res.redirect("/reset-password");
  } else {
    res.render("reset-password", {
      title: "Reset Password",
      token: reset_token,
      user: user,
      successMessages: successMessages,
      errorMessages: errorMessages,
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
        return res.send("No token found in the database");
      }
      if (results.length == 0) {
        req.flash("error", "token not found");
        return res.redirect("/reset-password");
      } else {
        const expirationDate = new Date(results[0].reset_expires);
        if (expirationDate.getTime() < Date.now()) {
          return res.send("Token expired");
        } else {
          conn.query(
            "UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE reset_token = ?",
            [newPassword, reset_token],
            (err2) => {
              if (err2) {
                console.error(err2);
                return res.send("Error updating password");
              } else {
                req.flash("success", "Password successfully changed");
                return res.redirect("/");
              }
            }
          );
        }
      }
    }
  );
});

app.get("/admin-dashboard", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/");
  }
  conn.query("SELECT * FROM users", (err, results) => {
    res.render("admin-dashboard", {
      title: "Admin Dashboard",
      user: req.session.user,
      users: results,
      result: "",
    });
  });
});

app.post("/delete-user", (req, res) => {
  const userId = req.body.id;
  conn.query("DELETE FROM users WHERE id = ?", [userId], (err, result) => {
    conn.query("SELECT * FROM users", (err, users) => {
      const result = "User deleted successfully";
      res.render("admin-dashboard", {
        title: "Admin Dashboard",
        user: req.session.user,
        users: users,
        result: result,
      });
    });
  });
});

app.post("/delete-account", (req, res) => {
  const userId = req.session.user.id;
  conn.query("DELETE FROM users WHERE id = ?", [userId], (err, result) => {
    req.session.destroy(() => {
      return res.redirect("/");
    });
  });
});

app.post("/change-password", (req, res) => {
  const userId = req.session.user.id;
  const newpassword = req.body.newpassword;
  conn.query(
    "UPDATE users SET password = ? WHERE id = ?",
    [newpassword, userId],
    (err, results) => {
      console.log(`Password from ${userId} was changed to ${newpassword}`);
      req.flash("success", "Password changed");
      return res.redirect("/account");
    }
  );
});

app.get("/account", (req, res) => {
  const successMessages = req.flash("success");
  const errorMessages = req.flash("error");
  if (!req.session.user) {
    return res.redirect("/");
  }
  res.render("account", {
    title: "Account",
    user: req.session.user,
    successMessages: successMessages,
    errorMessages: errorMessages,
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
