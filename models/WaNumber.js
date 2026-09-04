const mongoose = require('mongoose');

const waNumberSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  status: { type: String, enum: ['active', 'blacklist'], default: 'active' },
  addedBy: { type: String, required: true }, // username yang menambahkan
  addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WaNumber', waNumberSchema);
