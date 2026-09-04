const mongoose = require('mongoose');

// Pesan private (2 orang) ATAU pesan grup — dibedakan lewat field roomId
const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true }, // "private:userA:userB" (urut abjad) atau "group:<groupId>"
  from: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: String }], // list username
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  Message: mongoose.model('Message', messageSchema),
  Group: mongoose.model('Group', groupSchema)
};
