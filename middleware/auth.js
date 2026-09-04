const User = require('../models/User');

// Wajib login
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect('/login');
}

// Wajib role tertentu ke atas (pakai ROLE_LEVELS)
function requireRole(minRole) {
  const levels = User.ROLE_LEVELS;
  return (req, res, next) => {
    if (!req.session || !req.session.role) return res.redirect('/login');
    const myLevel = levels[req.session.role] || 0;
    const needLevel = levels[minRole] || 0;
    if (myLevel >= needLevel) return next();
    return res.status(403).render('error', {
      title: 'Akses Ditolak',
      msg: `Fitur ini butuh role minimal "${minRole}". Role kamu: "${req.session.role}".`
    });
  };
}

// Ambil IP asli klien (support proxy Vercel)
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip;
}

module.exports = { requireLogin, requireRole, getClientIp };
