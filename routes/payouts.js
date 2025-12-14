const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const PaymentPayout = require('../models/PaymentPayout');
const Employee = require('../models/Employee');
const Shop = require('../models/Shop');
const { protect } = require('../middleware/auth');

// create payout
router.post('/', protect, asyncHandler(async (req, res) => {
  const { employeeId, payoutDate, amountPaid, payoutStartDate, payoutEndDate } = req.body;
  if (!employeeId || !payoutDate || !amountPaid || !payoutStartDate || !payoutEndDate) { res.status(400); throw new Error('All fields required'); }
  const emp = await Employee.findById(employeeId).populate('shop', 'admin');
  if (!emp) { res.status(404); throw new Error('Employee not found'); }
  // if ShopAdmin ensure ownership
  if (req.user.role === 'ShopAdmin' && emp.shop.admin.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Forbidden'); }
  const payout = await PaymentPayout.create({
    employee: employeeId,
    payoutDate: new Date(payoutDate),
    amountPaid,
    payoutStartDate: new Date(payoutStartDate),
    payoutEndDate: new Date(payoutEndDate)
  });
  res.status(201).json(payout);
}));

// list payouts
router.get('/', protect, asyncHandler(async (req, res) => {
  const { employeeId, from, to } = req.query;
  const filter = {};
  if (employeeId) filter.employee = employeeId;
  if (from || to) {
    filter.payoutDate = {};
    if (from) filter.payoutDate.$gte = new Date(from);
    if (to) filter.payoutDate.$lte = new Date(to);
  }
  const payouts = await PaymentPayout.find(filter).populate('employee', 'name');
  res.json(payouts);
}));

module.exports = router;
