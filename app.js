const express = require("express");
const session = require("express-session");
const env = require("dotenv");
require("dotenv").config();
const mysql = require("mysql2");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const flash = require("express-flash");
const { userInfo } = require("os");
const app = express();
const port = 3000;

const dbhost = process.env.DB_HOST;
const dbport = process.env.DB_PORT;
const dbuser = process.env.DB_USER;
const dbpassword = process.env.DB_PASSWORD;
const dbname = process.env.DB_NAME;

const mailhost = process.env.MAIL_HOST;
const mailuser = process.env.MAIL_USER;
const mailpassword = process.env.MAIL_PASSWORD;

let conn;

function connectToDatabase() {
  conn = mysql.createConnection({
    host: dbhost,
    port: dbport,
    user: dbuser,
    password: dbpassword,
    database: dbname,
  });
  conn.connect((err, res) => {
    if (err) {
      console.error("❌DB CONN", err);
      connectToDatabase();
    } else {
      console.log("✅DB CONN", res);
    }
  });
}
connectToDatabase();

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
  conn.query(
    "SELECT COUNT(*) AS tickets FROM tickets WHERE user_id = ?",
    [req.session.user.id],
    (err, results1) => {
      const tickets = results1[0].tickets;
      conn.query(
        "SELECT COUNT(*) AS openTickets FROM tickets WHERE user_id = ? && status = 1",
        [req.session.user.id],
        (err, results2) => {
          const openTickets = results2[0].openTickets;
          conn.query(
            "SELECT COUNT(*) AS closedTickets FROM tickets WHERE user_id = ? && status = 0",
            [req.session.user.id],
            (err, results3) => {
              const closedTickets = results3[0].closedTickets;
              res.render("dashboard", {
                title: "Dashboard",
                user: req.session.user,
                tickets: tickets,
                openTickets: openTickets,
                closedTickets: closedTickets,
              });
            }
          );
        }
      );
    }
  );
});

app.post("/register", (req, res) => {
  const email = req.body.email;
  const username = req.body.username;
  const password = req.body.password;
  const role = "user";
  const verification_token = crypto.randomBytes(32).toString("hex");
  conn.query(
    "INSERT INTO users (email, username, password, role, verification_token, verified) VALUES (?,?,?,?,?,FALSE)",
    [email, username, password, role, verification_token],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.send("There was a problem with your registration");
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
        async function emailfunction() {
          const info = await transporter.sendMail({
            from: `"Jauni.de - Mail System" <${mailuser}>`,
            to: `${email}`,
            subject: "Account Activation",
            text: `Activate html to see relevant content`,
            html: `
                  <p>Here's the link to activate your account:</p>
                  <p><a href="http://localhost:3000/verify-mail?token=${verification_token}">Activate Account</a></p>
                  `,
          });
          console.log("Message sent: %s", info.messageId);
        }
        emailfunction().catch(console.error);
        console.log(`✅ Registration by ${role} ${email} with ${password}`);
        req.flash(
          "success",
          "Registration sucessful. Please check your inbox to verify your account"
        );
        return res.redirect("/login");
      }
    }
  );
});

app.get("/verify-mail", (req, res) => {
  const successMessages = req.flash("success");
  const errorMessages = req.flash("error");
  const verification_token = req.query.token;
  if (!verification_token) {
    req.flash("error", "token is missing");
    return res.redirect("/login");
  } else {
    conn.query(
      "UPDATE users SET verification_token = NULL, verified = TRUE WHERE verification_token = ?",
      [verification_token],
      (err, result) => {
        req.flash("success", "Email verified. You are now able to login.");
        res.redirect("/login");
      }
    );
  }
});

app.get("/verify-new-mail", (req, res) => {
  const successMessages = req.flash("success");
  const errorMessages = req.flash("error");
  const email_change_token = req.query.token;
  if (!email_change_token) {
    req.flash("error", "token is missing");
    return res.redirect("/login");
  } else {
    conn.query(
      "UPDATE users SET email = new_email, new_email = NULL, email_change_token = NULL WHERE email_change_token = ?",
      [email_change_token],
      (err, result) => {
        req.flash("success", "Email changed");
        res.redirect("/account");
      }
    );
  }
});

app.post("/login", (req, res) => {
  const identifier = req.body.identifier;
  const password = req.body.password;
  conn.query(
    "SELECT * FROM users WHERE email = ? OR username = ?",
    [identifier, identifier],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.send("No email/username found in the database");
      }
      if (results.length == 0) {
        req.flash("error", "Email/Username not found");
        return res.redirect("/login");
      } else if (results[0].password == password) {
        if (!results[0].verified) {
          req.flash("error", "Please verify your email before logging in.");
          return res.redirect("/login");
        }
        conn.query(
          "UPDATE users SET last_login = NOW() WHERE email = ? OR username = ?",
          [identifier, identifier]
        );
        console.log(
          `✅ Login by ${results[0].role} ${results[0].email} with ${results[0].password}`
        );
        req.session.user = {
          id: results[0].id,
          email: results[0].email,
          username: results[0].username,
          role: results[0].role,
        };
        return res.redirect("/dashboard");
      } else {
        console.log(
          `❌ Login by ${results[0].role} ${results[0].email} with ${password} instead of ${results[0].password}`
        );
        req.flash("error", "Wrong password");
        return res.redirect("/login");
      }
    }
  );
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
  conn.query("SELECT * FROM users", (err, results1) => {
    conn.query("SELECT * FROM tickets", (err, results2) => {
      conn.query(
        "SELECT COUNT(*) AS tickets FROM tickets",
        [req.session.user.id],
        (err, results3) => {
          const tickets = results3[0].tickets;
          conn.query(
            "SELECT COUNT(*) AS openTickets FROM tickets WHERE status = 1",
            [req.session.user.id],
            (err, results4) => {
              const openTickets = results4[0].openTickets;
              conn.query(
                "SELECT COUNT(*) AS closedTickets FROM tickets WHERE status = 0",
                [req.session.user.id],
                (err, results5) => {
                  const closedTickets = results5[0].closedTickets;
                  res.render("admin-dashboard", {
                    title: "Admin Dashboard",
                    user: req.session.user,
                    users: results1,
                    tickets: results2,
                    result: "",
                    allTickets: tickets,
                    openTickets: openTickets,
                    closedTickets: closedTickets,
                  });
                }
              );
            }
          );
        }
      );
    });
  });
});

app.post("/delete-user", (req, res) => {
  const userId = req.body.id;
  conn.query("DELETE FROM users WHERE id = ?", [userId], (err, result) => {
    conn.query("SELECT * FROM users", (err, users) => {
      return res.redirect("/admin-dashboard");
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

app.post("/change-username", (req, res) => {
  const userId = req.session.user.id;
  const newUsername = req.body.newUsername;
  conn.query(
    "UPDATE users SET username = ? WHERE id = ?",
    [newUsername, userId],
    (err, results) => {
      console.log(`Username from ${userId} was changed to ${newUsername}`);
      req.flash("success", "Username changed");
      return res.redirect("/account");
    }
  );
});

app.post("/change-email", (req, res) => {
  const userId = req.session.user.id;
  const newEmail = req.body.newEmail;
  const email_token = crypto.randomBytes(32).toString("hex");
  conn.query(
    "UPDATE users SET new_email = ?, email_change_token = ? WHERE id = ?",
    [newEmail, email_token, userId],
    (err, results) => {
      const transporter = nodemailer.createTransport({
        host: `${mailhost}`,
        port: 465,
        secure: true,
        auth: {
          user: `${mailuser}`,
          pass: `${mailpassword}`,
        },
      });
      async function emailfunction() {
        const info = await transporter.sendMail({
          from: `"Jauni.de - Mail System" <${mailuser}>`,
          to: `${newEmail}`,
          subject: "Email Address Change",
          text: `Activate html to see relevant content`,
          html: `
                  <p>Here's the link to confirm the change of email address:</p>
                  <p><a href="http://localhost:3000/verify-new-mail?token=${email_token}">Change Email Address</a></p>
                  `,
        });
        console.log("Message sent: %s", info.messageId);
      }
      emailfunction();
      req.flash("success", "Email was sent to Inbox of new Email Address");
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
  const userId = req.session.user.id;
  conn.query("SELECT * FROM users WHERE id = ?", [userId], (err, results) => {
    res.render("account", {
      title: "Account",
      user: results[0],
      successMessages: successMessages,
      errorMessages: errorMessages,
    });
  });
});

app.get("/tickets", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  const userId = req.session.user.id;
  conn.query(
    "SELECT * FROM tickets WHERE user_id = ?",
    [userId],
    (err, result) => {
      res.render("tickets", {
        title: "Tickets",
        user: req.session.user,
        tickets: result,
      });
    }
  );
});

app.get("/tickets/new", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  res.render("create-ticket", {
    title: "Create Ticket",
    user: req.session.user,
  });
});

app.get("/tickets/:id", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  ticketId = req.params.id;
  conn.query(
    "SELECT * FROM tickets WHERE id = ?",
    [ticketId],
    (err, results1) => {
      const ticket = results1[0];
      if (
        req.session.user.role !== "admin" &&
        ticket.user_id !== req.session.user.id
      ) {
        return res.redirect("/");
      }
      conn.query(
        `SELECT ticket_messages.*, users.username
        FROM ticket_messages
        JOIN users ON user_id = users.id
        WHERE ticket_id = ?
        ORDER BY created_at DESC`,
        [ticketId],
        (err, results2) => {
          res.render("ticket-details", {
            ticket: results1[0],
            messages: results2,
            user: req.session.user,
            title: "Ticket Details",
          });
        }
      );
    }
  );
});

app.post("/tickets", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  const userId = req.session.user.id;
  const category = req.body.category;
  const message = req.body.firstMessage;
  const status = true;
  const created_at = new Date();
  if (category) {
    conn.query(
      "INSERT INTO tickets (user_id, category, status, created_at) VALUES (?,?,?,?)",
      [userId, category, status, created_at],
      (err, result) => {
        const ticketId = result.insertId;
        conn.query(
          "INSERT INTO ticket_messages (ticket_id, user_id, message, created_at) VALUES (?,?,?,?)",
          [ticketId, userId, message, created_at],
          (err, result) => {
            res.redirect(`/tickets/${ticketId}`);
          }
        );
      }
    );
  }
});

app.post("/tickets/:id/messages", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  const ticketId = req.params.id;
  const userId = req.session.user.id;
  const message = req.body.message;
  const created_at = new Date();

  conn.query(
    "INSERT INTO ticket_messages (ticket_id, user_id, message, created_at) VALUES (?,?,?,?)",
    [ticketId, userId, message, created_at],
    (err, result) => {
      res.redirect(`/tickets/${ticketId}`);
    }
  );
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
