const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Rota = require('../models/Rota');
const Employee = require('../models/Employee');
const Shop = require('../models/Shop');
const { protect, shopAdminOnly } = require('../middleware/auth');

// create rota
router.post('/', protect, asyncHandler(async (req, res) => {
  const { shopId, employeeId, shiftDate, scheduledStart, scheduledEnd, note } = req.body;
  if (!shopId || !employeeId || !shiftDate) { res.status(400); throw new Error('shopId, employeeId and shiftDate required'); }

  const shop = await Shop.findById(shopId);
  if (!shop) { res.status(404); throw new Error('Shop not found'); }
  if (req.user.role === 'ShopAdmin' && shop.admin.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Forbidden');
  }

  // ensure employee belongs to shop
  const emp = await Employee.findById(employeeId);
  if (!emp || emp.shop.toString() !== shopId) {
    res.status(400); throw new Error('Employee not found in this shop');
  }

  const rota = await Rota.create({ shop: shopId, employee: employeeId, shiftDate, scheduledStart, scheduledEnd, note });
  res.status(201).json(rota);
}));

// list rotas for a shop or employee
router.get('/', protect, asyncHandler(async (req, res) => {
  // accept shopId, employeeId, date range
  const { shopId, employeeId, from, to } = req.query;
  const filter = {};
  if (shopId) filter.shop = shopId;
  if (employeeId) filter.employee = employeeId;
  if (from || to) filter.shiftDate = {};
  if (from) filter.shiftDate.$gte = new Date(from);
  if (to) filter.shiftDate.$lte = new Date(to);

  // If ShopAdmin, ensure shop belongs to them (if present)
  if (req.user.role === 'ShopAdmin' && shopId) {
    const shop = await Shop.findById(shopId);
    if (!shop || shop.admin.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Forbidden'); }
  }

  const rotas = await Rota.find(filter).populate('employee', 'name');
  res.json(rotas);
}));

// update rota
router.put('/:id', protect, asyncHandler(async (req, res) => {
  const rota = await Rota.findById(req.params.id).populate('shop');
  if (!rota) { res.status(404); throw new Error('Rota not found'); }
  if (req.user.role === 'ShopAdmin' && rota.shop.admin.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Forbidden'); }
  Object.assign(rota, req.body);
  await rota.save();
  res.json(rota);
}));

// delete rota
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  // Find rota first (for permission check)
  const rota = await Rota.findById(req.params.id).populate('shop');

  if (!rota) {
    res.status(404);
    throw new Error('Rota not found');
  }

  // ShopAdmin authorization
  if (
    req.user.role === 'ShopAdmin' &&
    rota.shop.admin.toString() !== req.user._id.toString()
  ) {
    res.status(403);
    throw new Error('Forbidden');
  }

  // Delete using findByIdAndDelete
  await Rota.findByIdAndDelete(req.params.id);

  res.json({ message: 'Rota removed' });
}));


module.exports = router;
