const mongoose = require('mongoose');

// Urutan role dari terendah ke tertinggi (dipakai buat pengecekan hak akses)
const ROLE_LEVELS = {
  user: 1,
  ress: 2,
  partner: 3,
  admin: 4,
  moderator: 5,
  owner: 99
};

// Limit default per role (owner bisa override manual per-user lewat panel)
const DEFAULT_LIMITS = {
  user: 3,       // awalnya diminta 1x, sudah diubah user jadi 3x
  ress: 10,
  partner: 17,
  admin: 25,
  moderator: 30,
  owner: 999999  // owner tidak pernah kehabisan limit
};

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: Object.keys(ROLE_LEVELS), default: 'user' },

  limit: { type: Number, default: 3 },        // sisa limit pakai
  limitTotal: { type: Number, default: 3 },   // limit total (buat tampilan "X/Y dipakai")

  // === Keamanan anti share akun ===
  lockedIp: { type: String, default: null },   // IP yang berhasil login pertama kali
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },  // dikunci sementara kalau 5x salah password

  isBanned: { type: Boolean, default: false },
  isSuspicious: { type: Boolean, default: false }, // ditandai owner via monitoring

  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: null },

  createdAt: { type: Date, default: Date.now }
});

userSchema.statics.ROLE_LEVELS = ROLE_LEVELS;
userSchema.statics.DEFAULT_LIMITS = DEFAULT_LIMITS;

module.exports = mongoose.model('User', userSchema);
