const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Punching = require('../models/Punching');
const Employee = require('../models/Employee');
const Shop = require('../models/Shop');
const { protect } = require('../middleware/auth');

// punch in
router.post('/in', protect, asyncHandler(async (req, res) => {
  const { shopId, employeeId, punchInDatetime } = req.body;
  if (!shopId || !employeeId || !punchInDatetime) { res.status(400); throw new Error('shopId, employeeId and punchInDatetime required'); }

  const shop = await Shop.findById(shopId);
  if (!shop) { res.status(404); throw new Error('Shop not found'); }
  const emp = await Employee.findById(employeeId);
  if (!emp || emp.shop.toString() !== shopId) { res.status(400); throw new Error('Employee not found in this shop'); }

  const p = await Punching.create({ shop: shopId, employee: employeeId, punchInDatetime: new Date(punchInDatetime) });
  res.status(201).json(p);
}));

// punch out
router.post('/out', protect, asyncHandler(async (req, res) => {
  const { punchingId, punchOutDatetime } = req.body;
  if (!punchingId || !punchOutDatetime) { res.status(400); throw new Error('punchingId and punchOutDatetime required'); }

  const p = await Punching.findById(punchingId);
  if (!p) { res.status(404); throw new Error('Punching not found'); }
  p.punchOutDatetime = new Date(punchOutDatetime);
  await p.save();
  res.json(p);
}));

// list punchings by shop or employee or date range
router.get('/', protect, asyncHandler(async (req, res) => {
  const { shopId, employeeId, from, to } = req.query;
  const filter = {};
  if (shopId) filter.shop = shopId;
  if (employeeId) filter.employee = employeeId;
  if (from || to) filter.punchInDatetime = {};
  if (from) filter.punchInDatetime.$gte = new Date(from);
  if (to) filter.punchInDatetime.$lte = new Date(to);
  const punches = await Punching.find(filter).populate('employee', 'name');
  res.json(punches);
}));

module.exports = router;
