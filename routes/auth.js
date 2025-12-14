const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const { protect, adminOnly, shopAdminOnly } = require('../middleware/auth');

// generate token
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// register admin (only for global Admin creation - in prod protect it)
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    res.status(400); throw new Error('Email and password required');
  }
  const exists = await Admin.findOne({ email });
  if (exists) { res.status(400); throw new Error('Admin with this email already exists'); }
  const admin = await Admin.create({ email, password, role: role || 'ShopAdmin' });
  res.status(201).json({
    _id: admin._id,
    email: admin.email,
    name:admin.name,
    role: admin.role,
    token: generateToken(admin._id)
  });
}));

// login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email });
  if (!admin) { res.status(401); throw new Error('Invalid credentials'); }
  const match = await admin.matchPassword(password);
  if (!match) { res.status(401); throw new Error('Invalid credentials'); }
  res.json({
    _id: admin._id,
    name:admin.name,
    email: admin.email,
    role: admin.role,
    token: generateToken(admin._id)
  });
}));


// GET current logged-in admin
router.get('/me', protect, asyncHandler(async (req, res) => {
  // req.user is set by protect middleware
  if (!req.user) {
    res.status(401);
    throw new Error('User not found');
  }

  // Return user info excluding password
  res.json({
    _id: req.user._id,
    name: req.user.name || "N/A",
    email: req.user.email,
    role: req.user.role,
  });
}));


// GET single admin by ID (optional)
router.get('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id).select('-password');
  if (!admin) {
    res.status(404);
    throw new Error('Admin not found');
  }
  res.json(admin);
}));


module.exports = router;
