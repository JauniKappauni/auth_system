const express = require('express');
const session = require('express-session');
const env = require('dotenv')
require('dotenv').config();
const mysql = require('mysql2');
const app = express();
const port = 3000;

const dbhost = process.env.DB_HOST;
const dbuser = process.env.DB_USER;
const dbpassword = process.env.DB_PASSWORD;
const dbname = process.env.DB_NAME;

const conn = mysql.createConnection({
    host: dbhost,
    user: dbuser,
    password: dbpassword,
    database: dbname
});
conn.connect(() => {
    console.log('Connection to the database successful')
})

app.set('view engine', 'ejs')

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}))
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
})

app.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
})

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
})

app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/')
    }
    res.render('dashboard', {title:'Dashboard',user:req.session.user});
})

app.post('/register', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    conn.query('INSERT INTO users (email, password) VALUES (?,?)', [email, password], (err, results) => {
        if(err){
            console.error(err)
            res.send('There was a problem with your registration')
        }
        else{
            console.log("Sucessfully registered")
            req.session.user = {id: results.insertId, email}
            res.redirect('/dashboard')
        }
    }
)
}
)

app.post('/login', (req,res) => {
    const email = req.body.email;
    const password = req.body.password;
    conn.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if(err){
            console.error(err)
            res.send('No email found in the database')
        }
        if(results.length == 0){
            res.send("email not found")
        }
        else if (results[0].password == password){
                console.log("Sucessfully logged in")
                req.session.user = {id: results[0].id, email}
                res.redirect('/dashboard')
        }
        else{
            res.send('Wrong password')
        }
    })})

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect("/")
    })
})

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`)
})