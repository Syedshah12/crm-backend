
const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Admin = require('../models/Admin');
const Shop = require('../models/Shop');
const Employee = require('../models/Employee');
const Rota = require('../models/Rota');
const Punching = require('../models/Punching');
const PaymentPayout = require('../models/PaymentPayout');
const { protect, adminOnly } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// ---------------------------
// List all admins
// ---------------------------
router.get('/', protect, adminOnly, asyncHandler(async (req, res) => {
  const admins = await Admin.find().select('-password');
  res.json(admins);
}));


// GET all admins with shop info populated
// GET all admins with shop info populated, sorted by latest
// GET all admins with shop info populated, sorted with Super Admin first
router.get('/with-shops', protect, adminOnly, asyncHandler(async (req, res) => {
  // 1) Get shops with their admin populated
  const shops = await Shop.find().populate('admin', '-password');

  // 2) Convert shop list into a mapping: adminId → shop data
  const adminShopMap = {};
  for (const shop of shops) {
    if (shop.admin?._id) {
      adminShopMap[shop.admin._id] = {
        shopName: shop.name,
        shopLogo: shop.logo,
        shopAddress: shop.address,
        shopId: shop._id
      };
    }
  }

  // 3) Get all admins
  const admins = await Admin.find().select('-password');

  // 4) Attach shop info for each admin
  const adminsWithShop = admins.map(admin => ({
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    shop: adminShopMap[admin._id] || null // null = unassigned
  }));

  // 5) Sort: Super Admins first, then by creation date descending
  adminsWithShop.sort((a, b) => {
    if (a.role === 'Admin' && b.role !== 'Admin') return -1; // Super Admin first
    if (b.role === 'Admin' && a.role !== 'Admin') return 1;  // Super Admin first
    // Otherwise, sort by creation date descending
    return new Date(b._id.getTimestamp()) - new Date(a._id.getTimestamp());
  });

  res.json(adminsWithShop);
}));





router.get('/stats', protect, adminOnly, asyncHandler(async (req, res) => {

  // 1) Total shops
  const totalShops = await Shop.countDocuments();

  // 2) Total shop admins
  const totalShopAdmins = await Admin.countDocuments({ role: 'ShopAdmin' });

  // 3) Total employees
  const totalEmployees = await Employee.countDocuments();

  // 4) Rotas this week
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());   // Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const rotasThisWeek = await Rota.countDocuments({
    shiftDate: { $gte: startOfWeek, $lt: endOfWeek }
  });

  // 5) Punches Today
  const startOfDay = new Date();
  startOfDay.setHours(0,0,0,0);

  const endOfDay = new Date();
  endOfDay.setHours(23,59,59,999);

  const punchesToday = await Punching.countDocuments({
    punchInDatetime: { $gte: startOfDay, $lte: endOfDay }
  });

  // 6) Salaries generated this month (count payouts)
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const salariesGenerated = await PaymentPayout.countDocuments({
    payoutDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
  });

  res.json({
    totalShops,
    totalShopAdmins,
    totalEmployees,
    rotasThisWeek,
    punchesToday,
    salariesGenerated
  });

}));



// GET unassigned ShopAdmins
router.get('/unassigned', protect, adminOnly, asyncHandler(async (req, res) => {
  // Get all assigned admin IDs
  const assignedAdminIds = await Shop.find().distinct('admin');

  // Find all ShopAdmins that are not assigned
  const unassignedAdmins = await Admin.find({
    role: 'ShopAdmin',
    _id: { $nin: assignedAdminIds },
  }).select('-password'); // exclude password

  res.json(unassignedAdmins);
}));

// ---------------------------
// Create a ShopAdmin
// ---------------------------
router.post('/', protect, adminOnly, asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required');
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    res.status(400);
    throw new Error('Email already in use');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const shopAdmin = await Admin.create({
    name,
    email,
    password: hashedPassword,
    role: 'ShopAdmin'
  });

  res.status(201).json({
    _id: shopAdmin._id,
    name: shopAdmin.name,
    email: shopAdmin.email,
    role: shopAdmin.role
  });
}));

// ---------------------------
// Update a ShopAdmin
// ---------------------------
router.put('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    res.status(404);
    throw new Error('Admin not found');
  }

  // Only update ShopAdmins
  if (admin.role !== 'ShopAdmin') {
    res.status(403);
    throw new Error('Cannot update this admin');
  }

  if (name) admin.name = name;
  if (email) admin.email = email;
  if (password) admin.password = await bcrypt.hash(password, 10);

  await admin.save();

  res.json({
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role
  });
}));

// ---------------------------
// Delete a ShopAdmin
// ---------------------------
router.delete('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
try {
    const admin = await Admin.findById(req.params.id);
  if (!admin) {
    res.status(404);
    throw new Error('Admin not found');
  }

  // Only allow deleting ShopAdmins
  if (admin.role !== 'ShopAdmin') {
    res.status(403);
    throw new Error('Cannot delete this admin');
  }

  // delete safely by id
  await Admin.findByIdAndDelete(req.params.id);

  res.json({ message: 'ShopAdmin removed' });
} catch (error) {
  console.log(error);
}
}));

module.exports = router;
