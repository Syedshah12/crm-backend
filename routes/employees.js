const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Shop = require('../models/Shop');
const { protect, adminOnly, shopAdminOnly } = require('../middleware/auth');
const { calculateSalaryForEmployee,calculateSalarySummary } =require('../utils/salaryCalc.js');
// create employee (ShopAdmin or Admin can create)
router.post('/', protect, shopAdminOnly(false), asyncHandler(async (req, res) => {
  const { name, shareCode, niNumber, address, phoneNumber, shiftTiming, payType, fixedDailyRate, hourlyRate, shopId, customHourlyRate, customDailyRate } = req.body;
  if (!name || !payType || !shopId) { res.status(400); throw new Error('name, payType and shopId required'); }

  const shop = await Shop.findById(shopId);
  if (!shop) { res.status(404); throw new Error('Shop not found'); }

  // If ShopAdmin, ensure they own the shop
  if (req.user.role === 'ShopAdmin' && shop.admin.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Forbidden');
  }

  const emp = await Employee.create({
    name, shareCode, niNumber, address, phoneNumber, shiftTiming,
    payType, fixedDailyRate, hourlyRate, shop: shop._id,
    customHourlyRate, customDailyRate
  });
  res.status(201).json(emp);``
}));

// get employees (Admin sees all; ShopAdmin sees their shop employees)
router.get('/', protect, asyncHandler(async (req, res) => {
  if (req.user.role === 'Admin') {
    const emps = await Employee.find().populate('shop', 'name');
    return res.json(emps);
  } else {
    const shops = await Shop.find({ admin: req.user._id }).select('_id');
    const shopIds = shops.map(s => s._id);
    const emps = await Employee.find({ shop: { $in: shopIds } }).populate('shop', 'name');
    return res.json(emps);
  }
}));

// get single employee
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id).populate('shop', 'name admin');
  if (!emp) { res.status(404); throw new Error('Employee not found'); }
  // if ShopAdmin, ensure ownership
  if (req.user.role === 'ShopAdmin') {
    if (emp.shop && emp.shop.admin.toString() !== req.user._id.toString()) {
      res.status(403); throw new Error('Forbidden');
    }
  }
  res.json(emp);
}));

// update employee
router.put('/:id', protect, asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id).populate('shop', 'admin');
  if (!emp) { res.status(404); throw new Error('Employee not found'); }
  if (req.user.role === 'ShopAdmin' && emp.shop.admin.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Forbidden');
  }
  Object.assign(emp, req.body);
  await emp.save();
  res.json(emp);
}));

// delete employee
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id).populate('shop', 'admin');
  if (!emp) {
    res.status(404);
    throw new Error('Employee not found');
  }

  // Check if ShopAdmin is allowed to delete
  if (req.user.role === 'ShopAdmin' && emp.shop.admin.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Forbidden');
  }

  // Delete the employee
  await Employee.findByIdAndDelete(req.params.id);
  // or: await emp.deleteOne();

  res.json({ message: 'Employee removed' });
}));


// calculate for a all employees in range
router.get(
  '/all/calc',
  protect,
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400);
      throw new Error('from and to query params required');
    }

    // Fetch all employees
    const employees = await Employee.find();

    // Calculate salary for each employee
    const salaryResults = [];
    for (const emp of employees) {
      const salary = await calculateSalaryForEmployee(emp._id, from, to);
      salaryResults.push(salary);
    }

    res.json({
      success: true,
      data: salaryResults,
    });
  })
);



// calculate working/salary summary for a single employee in range
router.get(
  '/summary/:employeeId',
  protect,
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400);
      throw new Error('Query parameters "from" and "to" are required');
    }

    try {
      const summary = await calculateSalarySummary(employeeId, from, to);
      res.json({
        success: true,
        data: summary
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  })
);


// calculate for a single employee in range
router.get('/employee/:id/calc', protect, asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) { res.status(400); throw new Error('from and to query params required'); }
  const result = await calculateSalaryForEmployee(req.params.id, from, to);
  res.json(result);
}));


module.exports = router;
