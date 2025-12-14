const mongoose = require('mongoose');

const RotaSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  shiftDate: { type: Date, required: true },
  scheduledStart: { type: String }, // 'HH:MM' strings
  scheduledEnd: { type: String },
  note: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Rota', RotaSchema);
