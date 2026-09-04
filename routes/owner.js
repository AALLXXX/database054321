const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const WaNumber = require('../models/WaNumber');
const TgToken = require('../models/TgToken');
const LoginLog = require('../models/LoginLog');
const Notification = require('../models/Notification');
const { requireLogin, requireRole } = require('../middleware/auth');

router.use(requireLogin, requireRole('owner'));

// ============ PANEL UTAMA OWNER ============
router.get('/owner', async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  const waCount = await WaNumber.countDocuments();
  const tgCount = await TgToken.countDocuments();
  const suspicious = await User.find({ isSuspicious: true });
  const recentLogs = await LoginLog.find().sort({ createdAt: -1 }).limit(30);

  res.render('owner', {
    users, waCount, tgCount, suspicious, recentLogs,
    dbName: process.env.DB_DISPLAY_NAME || 'ALEX DATABASE',
    flash: req.session.flash || null
  });
  req.session.flash = null;
});

// ============ BUAT USER BARU (dengan role & limit) ============
router.post('/owner/user/create', async (req, res) => {
  const { username, password, role } = req.body;
  const DEFAULT_LIMITS = User.DEFAULT_LIMITS;

  const exists = await User.findOne({ username });
  if (exists) {
    req.session.flash = { type: 'error', msg: 'Username sudah dipakai.' };
    return res.redirect('/owner');
  }

  const hash = await bcrypt.hash(password, 10);
  const limit = DEFAULT_LIMITS[role] ?? DEFAULT_LIMITS.user;
  await User.create({ username, passwordHash: hash, role, limit, limitTotal: limit });

  req.session.flash = { type: 'success', msg: `User "${username}" (role ${role}) berhasil dibuat.` };
  res.redirect('/owner');
});

// ============ SET LIMIT MANUAL (owner bisa kasih limit berapa aja) ============
router.post('/owner/user/:id/limit', async (req, res) => {
  const { limit } = req.body;
  const user = await User.findById(req.params.id);
  if (user) {
    user.limit = parseInt(limit, 10) || 0;
    user.limitTotal = user.limit;
    await user.save();
    req.session.flash = { type: 'success', msg: `Limit "${user.username}" diubah jadi ${user.limit}.` };
  }
  res.redirect('/owner');
});

// ============ GANTI ROLE USER ============
router.post('/owner/user/:id/role', async (req, res) => {
  const { role } = req.body;
  const user = await User.findById(req.params.id);
  if (user) {
    user.role = role;
    await user.save();
    req.session.flash = { type: 'success', msg: `Role "${user.username}" diubah jadi ${role}.` };
  }
  res.redirect('/owner');
});

// ============ BAN / UNBAN USER ============
router.post('/owner/user/:id/ban', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    user.isBanned = !user.isBanned;
    await user.save();
  }
  res.redirect('/owner');
});

// ============ RESET IP LOCK (kalau user ganti device/IP sah) ============
router.post('/owner/user/:id/reset-ip', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    user.lockedIp = null;
    user.isSuspicious = false;
    await user.save();
    req.session.flash = { type: 'success', msg: `IP lock "${user.username}" sudah direset. Login berikutnya akan set IP baru.` };
  }
  res.redirect('/owner');
});

// ============ HAPUS USER ============
router.post('/owner/user/:id/delete', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.redirect('/owner');
});

// ============ KELOLA DATABASE WA / TG ============
router.get('/owner/database', async (req, res) => {
  const waList = await WaNumber.find().sort({ addedAt: -1 });
  const tgList = await TgToken.find().sort({ addedAt: -1 });
  res.render('owner-database', {
    waList, tgList,
    dbName: process.env.DB_DISPLAY_NAME || 'ALEX DATABASE',
    flash: req.session.flash || null
  });
  req.session.flash = null;
});

router.post('/owner/wa/:id/delete', async (req, res) => {
  await WaNumber.findByIdAndDelete(req.params.id);
  res.redirect('/owner/database');
});

router.post('/owner/tg/:id/delete', async (req, res) => {
  await TgToken.findByIdAndDelete(req.params.id);
  res.redirect('/owner/database');
});

// Hapus SEMUA token (sesuai request: "hapus semua token kyk add ulang")
router.post('/owner/tg/delete-all', async (req, res) => {
  await TgToken.deleteMany({});
  req.session.flash = { type: 'success', msg: 'Semua token Telegram sudah dihapus dari database.' };
  res.redirect('/owner/database');
});

router.post('/owner/wa/delete-all', async (req, res) => {
  await WaNumber.deleteMany({});
  req.session.flash = { type: 'success', msg: 'Semua nomor WhatsApp sudah dihapus dari database.' };
  res.redirect('/owner/database');
});

// ============ BROADCAST NOTIFIKASI ============
router.post('/owner/notify', async (req, res) => {
  const { message, target } = req.body;
  await Notification.create({ message, target: target || 'all' });
  req.session.flash = { type: 'success', msg: 'Notifikasi berhasil dikirim.' };
  res.redirect('/owner');
});

// ============ MONITORING REALTIME (auto-refresh tiap beberapa detik lewat JS) ============
router.get('/owner/monitor', async (req, res) => {
  const logs = await LoginLog.find().sort({ createdAt: -1 }).limit(100);
  const suspicious = await User.find({ isSuspicious: true });
  res.render('owner-monitor', {
    logs, suspicious,
    dbName: process.env.DB_DISPLAY_NAME || 'ALEX DATABASE'
  });
});

// Endpoint JSON dipakai JS buat polling data monitoring tanpa reload halaman
router.get('/owner/monitor/data', async (req, res) => {
  const logs = await LoginLog.find().sort({ createdAt: -1 }).limit(50);
  const suspicious = await User.find({ isSuspicious: true }).select('username role lastLoginIp lockedIp');
  res.json({ logs, suspicious });
});

module.exports = router;
