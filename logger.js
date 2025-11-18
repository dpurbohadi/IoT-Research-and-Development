const express = require('express');
const session = require('express-session');
const cors = require('cors');
const app = express();
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
var currentData;

var mysql = require('mysql');

var db = mysql.createConnection ({
    host: 'localhost',
    user: 'u7565784_research',
    password: 'Ti-69696901',
    database: 'u7565784_research'
});

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/datalogger', function (req, res) {
    res.sendFile(path.join(__dirname,'index.html'));
})

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
            res.status(500).send(err.stack);
            return;
        }
        res.json(results);
    });
})

app.get('/datalogger/dbtest', function (req, res) {
    db.connect((err) => {
        if (err) {
            console.error('Error connecting to database:', err.stack);
            return;
        }
        res.send('Connected to database as ID ' + db.threadId);
    });
    db.end;
})

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
    db.query(sql, [user.firstname,user.lastname,user.address,user.phone,user.email,user.username,user.password,user.active,user.created_date,user.last_access,user.longitude,user.latitude,apiKey], (err, result) => {
    if (err) {
        console.error('Error inserting data:', err.stack);
        res.status(500).send(err.stack);
        return;
    }
        res.send("created user");
    });
})

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
            res.status(500).send('Terjadi kesalahan saat update lokasi');
            return;
        }

        if (result.affectedRows === 0) {
            res.status(404).send('Username tidak ditemukan');
        } else {
            res.send('Lokasi berhasil diperbarui');
        }
    });
});




app.get('/datalogger/test', (req, res) => {
  const sql = 'INSERT INTO logger (station_id, data_id, gdate, gtime, v1, v2, v3, v4, v5, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, ["test", "test01", "02/03/2024", "00.01", "1", "2", "3", "4", "5", "dummy"], (err, result) => {
    if (err) {
        console.error('Error inserting data:', err.stack);
        res.status(500).send(err.stack);
        return;
    }
        res.send("data saved");
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
      res.send({ message: "Login berhasil", user: results[0] });
    } else {
      res.status(401).send({ message: "Username atau password salah" });
    }
  });
});


app.post('/datalogger/store', (req, res) => {
  const data = req.body;
  if (data.v4 === null ||data.v4 === undefined) {lux = 0} else {lux = data.v4}
  const sql = 'INSERT INTO logger (station_id, data_id, gdate, gtime, v1, v2, v3, v4, v5, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [data.pid, data.did, data.gdate, data.gtime, data.v1, data.v2, data.v3, lux, data.v5, data.type], (err, result) => {
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
    const json = {"id IoT ":data.pid, "Data IoT":data.did, "tanggal":data.gdate, "waktu":data.gtime, "suhu udara":data.v1, "kelembaban udara":data.v2, "kelembaban tanah":data.v3, "intensitas cahaya":data.v4, "ph tanah":data.v5, "data tanah":data.type};
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
    const sql = 'SELECT * FROM u7565784_research.logger';
    db.query(sql, (err, result) => {
        if (err) {res.send(err);}
        res.send(result);
    });
    db.end;
})

app.post('/datalogger/read', function (req, res) {
    let id = req.body;
    res.setHeader('Referrer-Policy', 'no-referrer'); 
    const sql = 'SELECT * FROM u7565784_research.logger WHERE station_id=? AND gdate BETWEEN ? AND ? AND ((MINUTE(gtime)=30) OR (MINUTE(gtime)=0)) AND SECOND(gtime)=0';
    db.query(sql, [id.sid, id.dateM, id.dateH], (err, result) => {
        if (err) {res.send(id);}
        res.send(result);
    });
    db.end;
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
