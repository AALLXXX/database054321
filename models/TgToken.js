const mongoose = require('mongoose');

const tgTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },   // Telegram ID owner bot
  botUsername: { type: String, default: null }, // diisi otomatis saat cek valid
  status: { type: String, enum: ['active', 'blacklist'], default: 'active' },
  isValid: { type: Boolean, default: null },    // null = belum pernah dicek
  lastCheckedAt: { type: Date, default: null },
  addedBy: { type: String, required: true },
  addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TgToken', tgTokenSchema);
