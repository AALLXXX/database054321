const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  target: { type: String, default: 'all' }, // 'all' atau role tertentu, atau username spesifik
  createdAt: { type: Date, default: Date.now },
  readBy: [{ type: String }] // daftar username yang sudah baca
});

module.exports = mongoose.model('Notification', notificationSchema);
