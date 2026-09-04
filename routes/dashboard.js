const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const User = require('../models/User');
const WaNumber = require('../models/WaNumber');
const TgToken = require('../models/TgToken');
const Notification = require('../models/Notification');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

// ============ DASHBOARD UTAMA ============
router.get('/dashboard', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return req.session.destroy(() => res.redirect('/login'));

  const myWa = await WaNumber.find({ addedBy: user.username }).sort({ addedAt: -1 });
  const myTg = await TgToken.find({ addedBy: user.username }).sort({ addedAt: -1 });

  const notifs = await Notification.find({
    $or: [{ target: 'all' }, { target: user.role }, { target: user.username }]
  }).sort({ createdAt: -1 }).limit(10);

  res.render('dashboard', {
    user, myWa, myTg, notifs,
    dbName: process.env.DB_DISPLAY_NAME || 'ALEX DATABASE',
    flash: req.session.flash || null
  });
  req.session.flash = null;
});

// ============ TAMBAH NOMOR WHATSAPP ============
router.post('/wa/add', async (req, res) => {
  const user = await User.findById(req.session.userId);
  let { number } = req.body;
  number = (number || '').replace(/[^0-9]/g, '');

  if (user.limit <= 0) {
    req.session.flash = { type: 'error', msg: 'Limit kamu sudah habis. Hubungi owner untuk nambah limit.' };
    return res.redirect('/dashboard');
  }
  if (number.length < 8 || number.length > 15) {
    req.session.flash = { type: 'error', msg: 'Nomor tidak valid (harus 8-15 digit).' };
    return res.redirect('/dashboard');
  }
  const exists = await WaNumber.findOne({ number });
  if (exists) {
    req.session.flash = { type: 'error', msg: 'Nomor ini sudah terdaftar di database.' };
    return res.redirect('/dashboard');
  }

  await WaNumber.create({ number, addedBy: user.username });
  user.limit -= 1;
  await user.save();

  req.session.flash = { type: 'success', msg: `Nomor ${number} berhasil ditambahkan. Sisa limit: ${user.limit}` };
  res.redirect('/dashboard');
});

// ============ TAMBAH TOKEN TELEGRAM ============
router.post('/tg/add', async (req, res) => {
  const user = await User.findById(req.session.userId);
  const { token, ownerId } = req.body;

  if (user.limit <= 0) {
    req.session.flash = { type: 'error', msg: 'Limit kamu sudah habis. Hubungi owner untuk nambah limit.' };
    return res.redirect('/dashboard');
  }
  if (!token || !ownerId) {
    req.session.flash = { type: 'error', msg: 'Token dan Owner ID wajib diisi.' };
    return res.redirect('/dashboard');
  }
  const exists = await TgToken.findOne({ token });
  if (exists) {
    req.session.flash = { type: 'error', msg: 'Token ini sudah terdaftar.' };
    return res.redirect('/dashboard');
  }

  await TgToken.create({ token, ownerId, addedBy: user.username });
  user.limit -= 1;
  await user.save();

  req.session.flash = { type: 'success', msg: `Token berhasil ditambahkan. Sisa limit: ${user.limit}` };
  res.redirect('/dashboard');
});

// ============ CEK VALID TOKEN TELEGRAM ============
router.post('/tg/check/:id', async (req, res) => {
  const tg = await TgToken.findById(req.params.id);
  if (!tg) return res.redirect('/dashboard');

  try {
    const r = await fetch(`https://api.telegram.org/bot${tg.token}/getMe`);
    const json = await r.json();
    tg.isValid = !!json.ok;
    tg.botUsername = json.ok ? json.result.username : null;
  } catch (e) {
    tg.isValid = false;
  }
  tg.lastCheckedAt = new Date();
  await tg.save();

  req.session.flash = { type: tg.isValid ? 'success' : 'error', msg: tg.isValid ? `Token valid ✓ (@${tg.botUsername})` : 'Token tidak valid / sudah revoke.' };
  res.redirect('/dashboard');
});

module.exports = router;
