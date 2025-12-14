const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  shareCode: { type: String, default: null },
  niNumber: { type: String, default: null },
  address: { type: String, default: null },
  phoneNumber: { type: String, default: null },
  shiftTiming: { type: String, default: null },
  payType: { type: String, enum: ['Fixed Daily','Hourly'], required: true },
  fixedDailyRate: { type: Number, default: null }, // e.g. 50
  hourlyRate: { type: Number, default: null }, // e.g. 6
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  // optional overridden per-employee rate by shop admin:
  customHourlyRate: { type: Number, default: null },
  customDailyRate: { type: Number, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Employee', EmployeeSchema);
