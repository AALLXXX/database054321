require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const connectDB = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(helmet({ contentSecurityPolicy: false })); // header keamanan standar
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rate limit login: cegah brute-force otomatis (di luar limit 5x salah per akun)
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Terlalu banyak percobaan login dari IP ini. Coba lagi nanti.'
});
app.use('/login', loginLimiter);

app.use(session({
  secret: process.env.SESSION_SECRET || 'ganti-secret-ini',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true } // 7 hari
}));

// Selipkan info user & tema ke semua view otomatis
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.theme = req.cookies?.theme || 'black';
  next();
});

// Ganti tema warna UI (black/white/blue/orange/red/dll)
app.post('/set-theme', (req, res) => {
  const allowed = ['black', 'white', 'blue', 'orange', 'red', 'purple', 'green'];
  const theme = allowed.includes(req.body.theme) ? req.body.theme : 'black';
  res.cookie('theme', theme, { maxAge: 1000 * 60 * 60 * 24 * 365 });
  res.json({ ok: true, theme });
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/', require('./routes/owner'));
app.use('/', require('./routes/chat'));

app.use((req, res) => res.status(404).render('error', { title: '404', msg: 'Halaman tidak ditemukan.' }));

app.listen(PORT, () => console.log(`🚀 ${process.env.DB_DISPLAY_NAME || 'ALEX DATABASE'} jalan di http://localhost:${PORT}`));
