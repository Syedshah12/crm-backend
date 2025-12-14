const mongoose = require('mongoose');

const PunchingSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  punchInDatetime: { type: Date, required: true },
  punchOutDatetime: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Punching', PunchingSchema);
