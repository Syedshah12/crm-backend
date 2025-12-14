const mongoose = require('mongoose');

const PaymentPayoutSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  payoutDate: { type: Date, required: true }, // date employee took the payment
  amountPaid: { type: Number, required: true },
  payoutStartDate: { type: Date, required: true },
  payoutEndDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('PaymentPayout', PaymentPayoutSchema);
