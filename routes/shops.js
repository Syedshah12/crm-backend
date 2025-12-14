const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Admin = require('../models/Admin');
const Shop = require('../models/Shop');
const Employee = require('../models/Employee');
const Rota = require('../models/Rota');
const Punching = require('../models/Punching');
const PaymentPayout = require('../models/PaymentPayout');
const { protect, adminOnly, shopAdminOnly } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');


// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});



// Multer setup to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });


// GET Shop Dashboard (ShopAdmin only)
router.get(
  "/dashboard",
  protect,
  shopAdminOnly(),
  asyncHandler(async (req, res) => {
    console.log("Dashboard API hit");

    // ------------------------------------
    // 1) FIND SHOP OF THIS SHOPADMIN
    // ------------------------------------
    const shopRecord = await Shop.findOne({ admin: req.user._id }).select("_id");

    if (!shopRecord) {
      return res.status(404).json({ message: "Shop not found for this ShopAdmin" });
    }

    const shop = shopRecord._id;

    // ------------------------------------
    // 2) TOTAL EMPLOYEES
    // ------------------------------------
    const totalEmployees = await Employee.countDocuments({ shop });

    // ------------------------------------
    // 3) TODAY'S PUNCHES (Punching Model)
    // ------------------------------------
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todaysPunches = await Punching.countDocuments({
      shop,
      punchInDatetime: { $gte: startOfDay, $lte: endOfDay },
    });

    // ------------------------------------
    // 4) UPCOMING SHIFTS (next 7 days)
    // ------------------------------------
const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);

const sevenDaysLater = new Date(startOfToday);
sevenDaysLater.setDate(startOfToday.getDate() + 7);
sevenDaysLater.setHours(23, 59, 59, 999);

const upcomingShifts = await Rota.find({
  shop,
  shiftDate: { $gte: startOfToday, $lte: sevenDaysLater },
})
  .populate("employee", "name")
  .sort({ shiftDate: 1 })
  .limit(10);


    // ------------------------------------
    // 5) WEEKLY PAYOUT OVERVIEW
    // ------------------------------------

    // Calculate start of week (Monday)
    const startOfWeek = new Date();
    const currentDay = startOfWeek.getDay(); // Sunday = 0
    const diff = currentDay === 0 ? -6 : 1 - currentDay;

    startOfWeek.setDate(startOfWeek.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Aggregate payouts for employees of THIS SHOP only
    const payoutsThisWeek = await PaymentPayout.aggregate([
      {
        $lookup: {
          from: "employees",
          localField: "employee",
          foreignField: "_id",
          as: "emp",
        },
      },
      { $unwind: "$emp" },
      {
        $match: {
          "emp.shop": shop,
          payoutDate: { $gte: startOfWeek, $lte: endOfWeek },
        },
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$amountPaid" },
        },
      },
    ]);

    const weeklyPayout = payoutsThisWeek.length ? payoutsThisWeek[0].totalPaid : 0;

    // ------------------------------------
    // RETURN RESPONSE
    // ------------------------------------
    return res.json({
      success: true,
      data: {
        totalEmployees,
        todaysPunches,
        upcomingShifts,
        weeklyPayout,
      },
    });
  })
);



// Create shop (only Admins can create global shops; ShopAdmin can create shop for themselves via register flow)
router.post(
  '/',
  protect,
  adminOnly,
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    const {
      name,
      address,
      site,
      phoneNumber,
      rent,
      bills,
      shopOpenTime,
      shopCloseTime,
      adminId, // only use this
    } = req.body;

    if (!name) {
      res.status(400);
      throw new Error('Shop name is required');
    }

    if (!adminId) {
      res.status(400);
      throw new Error('adminId is required to assign a ShopAdmin');
    }

    // Fetch existing ShopAdmin
    const shopAdmin = await Admin.findById(adminId);
    if (!shopAdmin || shopAdmin.role !== 'ShopAdmin') {
      res.status(400);
      throw new Error('Invalid ShopAdmin ID');
    }

    // Upload logo to Cloudinary if provided
    let logoUrl = '';
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'shops' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      logoUrl = result.secure_url;
    }

    // Create Shop
    const shop = await Shop.create({
      name,
      logo: logoUrl,
      address,
      site,
      phoneNumber,
      admin: shopAdmin._id,
      rent: rent || 0,
      bills: bills || 0,
      shopOpenTime,
      shopCloseTime,
    });

    res.status(201).json(shop);
  })
);


// Get shops (Admin sees all; ShopAdmin sees only their shops)
router.get('/', protect, asyncHandler(async (req, res) => {
  if (req.user.role === 'Admin') {
    const shops = await Shop.find().populate('admin', 'email role');
    return res.json(shops);
  } else {
    const shops = await Shop.find({ admin: req.user._id }).populate('admin', 'email role');
    return res.json(shops);
  }
}));


// Update Shop
router.put('/:id', protect, adminOnly, upload.single('logo'), asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.params.id).populate('admin');
  if (!shop) {
    res.status(404);
    throw new Error('Shop not found');
  }

  const {
    name,
    address,
    site,
    phone,
    rent,
    bills,
    openTime,
    closeTime,
    adminId, // new way to assign admin
  } = req.body;

  // Update shop fields
  shop.name = name || shop.name;
  shop.address = address || shop.address;
  shop.site = site || shop.site;
  shop.phoneNumber = phone || shop.phoneNumber;
  shop.rent = rent || shop.rent;
  shop.bills = bills || shop.bills;
  shop.shopOpenTime = openTime || shop.shopOpenTime;
  shop.shopCloseTime = closeTime || shop.shopCloseTime;

  // Reassign ShopAdmin if adminId provided
  if (adminId) {
    const shopAdmin = await Admin.findById(adminId);
    if (!shopAdmin || shopAdmin.role !== 'ShopAdmin') {
      res.status(400);
      throw new Error('Invalid ShopAdmin ID');
    }
    shop.admin = shopAdmin._id;
  }

  // Handle logo upload to Cloudinary
  if (req.file) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'shops' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });
    shop.logo = result.secure_url;
  }

  await shop.save();
  res.json(await Shop.findById(shop._id).populate('admin'));
}));

// delete shop (Admin only)
router.delete(
  '/:id',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const deletedShop = await Shop.findByIdAndDelete(req.params.id);

    if (!deletedShop) {
      res.status(404);
      throw new Error('Shop not found');
    }

    res.json({ message: 'Shop removed successfully' });
  })
);




module.exports = router;
