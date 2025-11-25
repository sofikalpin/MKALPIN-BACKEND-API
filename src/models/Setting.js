const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  section: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Setting', SettingSchema);
