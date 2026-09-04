const express = require('express');
const router = express.Router();
const { Message, Group } = require('../models/Chat');
const User = require('../models/User');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

function privateRoomId(userA, userB) {
  return 'private:' + [userA, userB].sort().join(':');
}

// ============ HALAMAN CHAT ============
router.get('/chat', async (req, res) => {
  const me = req.session.username;
  const allUsers = await User.find({ username: { $ne: me } }).select('username role');
  const myGroups = await Group.find({ members: me });

  res.render('chat', {
    me, allUsers, myGroups,
    dbName: process.env.DB_DISPLAY_NAME || 'ALEX DATABASE'
  });
});

// ============ AMBIL PESAN PRIVATE (polling tiap beberapa detik dari JS) ============
router.get('/chat/private/:username', async (req, res) => {
  const me = req.session.username;
  const other = req.params.username;
  const roomId = privateRoomId(me, other);
  const messages = await Message.find({ roomId }).sort({ createdAt: 1 }).limit(200);
  res.json({ roomId, messages });
});

router.post('/chat/private/:username', async (req, res) => {
  const me = req.session.username;
  const other = req.params.username;
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Pesan kosong' });

  const roomId = privateRoomId(me, other);
  const msg = await Message.create({ roomId, from: me, text: text.trim() });
  res.json({ ok: true, msg });
});

// ============ GRUP ============
router.post('/chat/group/create', async (req, res) => {
  const me = req.session.username;
  const { name, members } = req.body; // members: comma separated usernames
  const memberList = (members || '').split(',').map(m => m.trim()).filter(Boolean);
  memberList.push(me);

  const group = await Group.create({
    name: name || 'Grup Baru',
    members: [...new Set(memberList)],
    createdBy: me
  });
  res.redirect('/chat');
});

router.get('/chat/group/:id', async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group || !group.members.includes(req.session.username)) {
    return res.status(403).json({ error: 'Kamu bukan anggota grup ini' });
  }
  const roomId = 'group:' + group._id;
  const messages = await Message.find({ roomId }).sort({ createdAt: 1 }).limit(200);
  res.json({ group, messages });
});

router.post('/chat/group/:id/send', async (req, res) => {
  const me = req.session.username;
  const group = await Group.findById(req.params.id);
  if (!group || !group.members.includes(me)) {
    return res.status(403).json({ error: 'Kamu bukan anggota grup ini' });
  }
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Pesan kosong' });

  const roomId = 'group:' + group._id;
  const msg = await Message.create({ roomId, from: me, text: text.trim() });
  res.json({ ok: true, msg });
});

module.exports = router;
