const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true }, // new field for Admin/ShopAdmin name
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'ShopAdmin'], default: 'Admin' } // Admin or ShopAdmin
}, { timestamps: true });

// Password comparison method
AdminSchema.methods.matchPassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

// Hash password before saving
AdminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('Admin', AdminSchema);
