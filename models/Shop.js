const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: null },    // path or URL
  address: { type: String, default: null },
  site: { type: String, default: null },
  phoneNumber: { type: String, default: null },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true }, // shop admin user
  rent: { type: Number, default: 0 },
  bills: { type: Number, default: 0 },
  shopOpenTime: { type: String },   // store as 'HH:MM' string
  shopCloseTime: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Shop', ShopSchema);
