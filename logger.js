const express = require('express');
const session = require('express-session');
const cors = require('cors');
const app = express();
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
var currentData;

var mysql = require('mysql');

// Main database connection
var db = mysql.createConnection ({
    host: 'localhost',
    user: 'u-xxxxxx',
    password: 'p-yyyyyy',
    database: 'db-zzzzzz'
});

// Initial connection for database creation
var initConn = mysql.createConnection({
    host: 'localhost',
    user: 'u-xxxxxx',
    password: 'p-yyyyyy'
});

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

// Create database and tables
initConn.connect(function (err) {
    if (err) {
        console.error('Failed to connect during initialization:', err.stack);
        return;
    }

    initConn.query('CREATE DATABASE IF NOT EXISTS datalogger', function (err) {
        if (err) {
            console.error('Failed to create datalogger database:', err.stack);
            return;
        }

        initConn.query('USE datalogger', function (err) {
            if (err) {
                console.error('Failed to select datalogger database:', err.stack);
                return;
            }

            var createUserTable = `
                CREATE TABLE IF NOT EXISTS user (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    firstname VARCHAR(100),
                    lastname VARCHAR(100),
                    address TEXT,
                    phone VARCHAR(50),
                    email VARCHAR(150),
                    username VARCHAR(100),
                    password VARCHAR(255),
                    active TINYINT,
                    created_date DATETIME,
                    last_access DATETIME,
                    longitude VARCHAR(50),
                    latitude VARCHAR(50),
                    apikey VARCHAR(255)
                )
            `;
            initConn.query(createUserTable, function (err) {
                if (err) {
                    console.error('Failed to create user table:', err.stack);
                    return;
                }

                var createLoggerTable = `
                    CREATE TABLE IF NOT EXISTS logger (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        station_id VARCHAR(100),
                        data_id VARCHAR(100),
                        gdate DATE,
                        gtime TIME,
                        v1 DOUBLE,
                        v2 DOUBLE,
                        v3 DOUBLE,
                        v4 DOUBLE,
                        v5 DOUBLE,
                        type VARCHAR(50)
                    )
                `;
                initConn.query(createLoggerTable, function (err) {
                    if (err) {
                        console.error('Failed to create logger table:', err.stack);
                        return;
                    }
                    console.log('Database and tables are ready');
                    initConn.end();
                });
            });
        });
    });
});

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routes
app.get('/datalogger', function (req, res) {
    res.sendFile(path.join(__dirname,'index.html'));
});

app.get('/datalogger/green.css', (req, res) => {
    res.set('Content-Type', 'text/css');
    res.sendFile(path.join(__dirname, 'datalogger/green.css'));
});

app.get('/datalogger/stations', (req, res) => {
    const sql = `
        SELECT DISTINCT longitude, latitude, firstname, lastname, address
        FROM user
        WHERE longitude IS NOT NULL AND latitude IS NOT NULL
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching unique positions:', err.stack);
            res.status(500).send('Error fetching positions');
            return;
        }
        res.json(results);
    });
});

app.get('/datalogger/dbtest', function (req, res) {
    db.connect((err) => {
        if (err) {
            console.error('Error connecting to database:', err.stack);
            return;
        }
        res.send('Connected to database as ID ' + db.threadId);
    });
    db.end;
});

const crypto = require("crypto");

function generateApiKey(username) {
  return crypto
    .createHash("sha256")
    .update(username + Date.now().toString())
    .digest("hex");
}

app.post('/datalogger/createuser', (req, res) => {
    const user = req.body;
    const apiKey = generateApiKey(user.firstname);
    const sql = 'INSERT INTO user (firstname,lastname,address,phone,email,username,password,active,created_date,last_access,longitude,latitude,apikey) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    db.query(sql, [
        user.firstname, user.lastname, user.address, user.phone, user.email, 
        user.username, user.password, user.active, user.created_date, 
        user.last_access, user.longitude, user.latitude, apiKey
    ], (err) => {
        if (err) {
            console.error('Error inserting user:', err.stack);
            res.status(500).send('Error inserting user');
            return;
        }
        res.send("User created");
    });
});

app.put('/datalogger/update-station/:username', (req, res) => {
    const { latitude, longitude } = req.body;
    const username = req.params.username;

    const sql = `
        UPDATE user 
        SET latitude = ?, longitude = ?
        WHERE username = ?
    `;

    db.query(sql, [latitude, longitude, username], (err, result) => {
        if (err) {
            console.error('Error updating location:', err.stack);
            res.status(500).send('Error updating location');
            return;
        }

        if (result.affectedRows === 0) {
            res.status(404).send('Username not found');
        } else {
            res.send('Location updated successfully');
        }
    });
});

app.get('/datalogger/test', (req, res) => {
    const sql = 'INSERT INTO logger (station_id, data_id, gdate, gtime, v1, v2, v3, v4, v5, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, ["test", "test01", "02/03/2024", "00.01", "1", "2", "3", "4", "5", "dummy"], (err) => {
        if (err) {
            console.error('Error inserting test data:', err.stack);
            res.status(500).send('Error inserting test data');
            return;
        }
        res.send("Test data saved");
    });
});

app.post('/datalogger/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM user WHERE username = ? AND password = ?';

    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error('Login error:', err.stack);
            return res.status(500).send('Server error');
        }

        if (results.length > 0) {
            res.send({ message: "Login successful", user: results[0] });
        } else {
            res.status(401).send({ message: "Invalid username or password" });
        }
    });
});

app.post('/datalogger/store', (req, res) => {
    const data = req.body;
    const lux = data.v4 == null ? 0 : data.v4;

    const sql = 'INSERT INTO logger (station_id, data_id, gdate, gtime, v1, v2, v3, v4, v5, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [
        data.pid, data.did, data.gdate, data.gtime, data.v1, data.v2, 
        data.v3, lux, data.v5, data.type
    ], (err) => {
        if (err) {
            console.error('Error inserting data:', err.stack);
            res.status(500).send('Error inserting data');
            return;
        }
        res.send(data);
    });
});

app.post('/datalogger/sampling', (req, res) => {
    const data = req.body;
    const id = data.pid;

    const json = {
        "IoT ID": data.pid,
        "IoT Data": data.did,
        "date": data.gdate,
        "time": data.gtime,
        "air temperature": data.v1,
        "air humidity": data.v2,
        "soil moisture": data.v3,
        "light intensity": data.v4,
        "soil pH": data.v5,
        "soil data": data.type
    };

    session[id] = json;
    res.send(session[id]);
});

app.post('/datalogger/current', (req, res) => {
    const data = req.body;
    const id = data.sid;
    res.send(session[id]);
});

app.get('/datalogger/get', function (req, res) {
    res.setHeader('Referrer-Policy', 'no-referrer');
    const sql = 'SELECT * FROM db-zzzzzz.logger';
    db.query(sql, (err, result) => {
        if (err) {
            res.send(err);
            return;
        }
        res.send(result);
    });
    db.end;
});

app.post('/datalogger/read', function (req, res) {
    let id = req.body;
    res.setHeader('Referrer-Policy', 'no-referrer');

    const sql = `
        SELECT * FROM db-zzzzzz.logger 
        WHERE station_id=? AND gdate BETWEEN ? AND ? 
        AND ((MINUTE(gtime)=30) OR (MINUTE(gtime)=0)) 
        AND SECOND(gtime)=0
    `;

    db.query(sql, [id.sid, id.dateM, id.dateH], (err, result) => {
        if (err) {
            res.send(id);
            return;
        }
        res.send(result);
    });
    db.end;
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
