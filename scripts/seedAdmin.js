// run node scripts/seedAdmin.js to create default admin
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

(async () => {
  try {
    await connectDB();
    const email = process.env.ADMIN_DEFAULT_EMAIL;
    const password = process.env.ADMIN_DEFAULT_PASSWORD;
    let admin = await Admin.findOne({ email });
    if (!admin) {
      admin = await Admin.create({ email, password, role: 'Admin' });
      console.log('Admin created', admin.email);
    } else {
      console.log('Admin already exists');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
