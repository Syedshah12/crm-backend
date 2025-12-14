const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const Admin = require('../models/Admin');
const Shop = require('../models/Shop');

const protect = asyncHandler(async (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    res.status(401);
    throw new Error('Not authorized, token missing');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Admin.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401);
      throw new Error('Not authorized, user not found');
    }
    req.user = user; // contains role
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token failed');
  }
});

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') return next();
  res.status(403);
  throw new Error('Admin only route');
};

// ShopAdmin middleware: ensure user is ShopAdmin and optionally that they belong to the shop being accessed
const shopAdminOnly = (allowShopIdCheck = true) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized');
    }
    if (req.user.role !== 'ShopAdmin') {
      res.status(403);
      throw new Error('ShopAdmin only route');
    }
    if (allowShopIdCheck) {
      const shopId = req.params.shopId || req.body.shopId || req.query.shopId;
      if (shopId) {
        const shop = await Shop.findById(shopId);
        if (!shop) {
          res.status(404);
          throw new Error('Shop not found');
        }
        if (shop.admin.toString() !== req.user._id.toString()) {
          res.status(403);
          throw new Error('Forbidden: you do not manage this shop');
        }
      }
    }
    next();
  });
};

module.exports = { protect, adminOnly, shopAdminOnly };
