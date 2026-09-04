const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const { getClientIp } = require('../middleware/auth');

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 menit dikunci setelah 5x salah

// ============ HALAMAN AWAL (belum login) ============
router.get('/', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.render('landing', {
    dbName: process.env.DB_DISPLAY_NAME || 'ALEX DATABASE',
    contactDev: process.env.CONTACT_DEV,
    contactCh: [process.env.CONTACT_CH1, process.env.CONTACT_CH2, process.env.CONTACT_CH3].filter(Boolean)
  });
});

// ============ LOGIN ============
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.render('login', {
    dbName: process.env.DB_DISPLAY_NAME || 'ALEX DATABASE',
    error: req.session.loginError || null
  });
  req.session.loginError = null;
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';

  const user = await User.findOne({ username: (username || '').trim() });

  if (!user) {
    await LoginLog.create({ username: username || '(kosong)', ip, result: 'wrong_password', userAgent: ua });
    req.session.loginError = 'Username atau password salah.';
    return res.redirect('/login');
  }

  // Cek apakah akun sedang dikunci sementara (kena 5x salah)
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const sisaMenit = Math.ceil((user.lockedUntil - new Date()) / 60000);
    await LoginLog.create({ username: user.username, ip, result: 'locked', userAgent: ua });
    req.session.loginError = `Akun terkunci sementara karena 5x salah password. Coba lagi ${sisaMenit} menit lagi.`;
    return res.redirect('/login');
  }

  if (user.isBanned) {
    await LoginLog.create({ username: user.username, ip, result: 'banned', userAgent: ua });
    req.session.loginError = 'Akun ini sudah di-banned. Hubungi developer.';
    return res.redirect('/login');
  }

  const match = await bcrypt.compare(password || '', user.passwordHash);
  if (!match) {
    user.failedAttempts += 1;
    if (user.failedAttempts >= MAX_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.failedAttempts = 0;
      user.isSuspicious = true; // tandai buat monitoring owner
    }
    await user.save();
    await LoginLog.create({ username: user.username, ip, result: 'wrong_password', userAgent: ua });
    req.session.loginError = 'Username atau password salah.';
    return res.redirect('/login');
  }

  // ====== INTI ANTI-SHARING: IP LOCK ======
  // Login pertama kali -> simpan IP ini sebagai "pemilik sah" akun.
  // Login berikutnya dari IP LAIN -> ditolak walau password benar.
  if (!user.lockedIp) {
    user.lockedIp = ip;
  } else if (user.lockedIp !== ip && user.role !== 'owner') {
    user.isSuspicious = true;
    await user.save();
    await LoginLog.create({ username: user.username, ip, result: 'ip_mismatch', userAgent: ua });
    req.session.loginError = 'Akun ini sudah terdaftar di perangkat/IP lain. Jika ini akunmu dan IP-mu berubah, hubungi developer untuk reset IP.';
    return res.redirect('/login');
  }

  // Login sukses
  user.failedAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  user.lastLoginIp = ip;
  await user.save();
  await LoginLog.create({ username: user.username, ip, result: 'success', userAgent: ua });

  req.session.userId = user._id.toString();
  req.session.username = user.username;
  req.session.role = user.role;

  return res.redirect('/dashboard');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ============ SETUP OWNER PERTAMA KALI ============
// Dipakai SEKALI di awal untuk bikin akun owner, lalu sebaiknya dihapus/dikomen dari server.js
router.get('/setup-owner', async (req, res) => {
  const already = await User.findOne({ role: 'owner' });
  if (already) return res.send('Akun owner sudah ada. Endpoint ini nonaktif demi keamanan.');

  const uname = process.env.OWNER_SETUP_USERNAME;
  const pass = process.env.OWNER_SETUP_PASSWORD;
  if (!uname || !pass) return res.send('OWNER_SETUP_USERNAME / OWNER_SETUP_PASSWORD belum diisi di .env');

  const hash = await bcrypt.hash(pass, 10);
  await User.create({
    username: uname,
    passwordHash: hash,
    role: 'owner',
    limit: User.DEFAULT_LIMITS.owner,
    limitTotal: User.DEFAULT_LIMITS.owner
  });
  res.send(`Akun owner "${uname}" berhasil dibuat. Silakan login di /login, lalu HAPUS route /setup-owner dari server.js.`);
});

module.exports = router;
