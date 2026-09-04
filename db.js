const mongoose = require('mongoose');

async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI belum diisi di file .env! Lihat tutorial.txt');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Terhubung ke MongoDB:', process.env.DB_DISPLAY_NAME || 'ALEX DATABASE');
  } catch (err) {
    console.error('❌ Gagal konek MongoDB:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
