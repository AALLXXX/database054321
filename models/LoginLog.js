const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  username: { type: String, required: true },
  ip: { type: String, required: true },
  result: { type: String, enum: ['success', 'wrong_password', 'ip_mismatch', 'locked', 'banned'], required: true },
  userAgent: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LoginLog', loginLogSchema);
