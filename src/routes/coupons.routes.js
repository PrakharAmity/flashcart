import express from 'express';
import { db } from '../db/index.js';

export const couponsRouter = express.Router();

couponsRouter.get('/', (req, res) => {
  res.json({ coupons: db.coupons });
});

couponsRouter.post('/validate', (req, res) => {
  const { code, orderAmount = 0 } = req.body;
  if (!code) {
    return res.status(400).json({ valid: false, error: 'Coupon code is required' });
  }

  const coupon = db.coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());
  if (!coupon) {
    return res.status(404).json({ valid: false, error: 'Invalid coupon code' });
  }

  if (orderAmount < coupon.minOrderValue) {
    return res.status(400).json({
      valid: false,
      error: `Coupon requires minimum order value of ₹${coupon.minOrderValue}`
    });
  }

  const discount = Math.min(coupon.maxDiscount, Math.round((orderAmount * coupon.discountPercent) / 100));

  res.json({
    valid: true,
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    discountAmount: discount,
    description: coupon.description
  });
});
