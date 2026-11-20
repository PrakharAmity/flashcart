import express from 'express';
import { checkoutService } from '../services/checkout.service.js';

export const checkoutRouter = express.Router();

function getUserId(req) {
  return req.user ? req.user.id : (req.headers['x-user-id'] || 'user-customer-demo');
}

// DL-BUG-001: Duplicate Checkout Requests
checkoutRouter.post('/place-order', async (req, res) => {
  try {
    const userId = getUserId(req);
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
    const order = await checkoutService.placeOrder(userId, req.body, idempotencyKey);
    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});
