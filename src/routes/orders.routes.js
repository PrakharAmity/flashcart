import express from 'express';
import { ordersService } from '../services/orders.service.js';

export const ordersRouter = express.Router();

function getUserId(req) {
  return req.user ? req.user.id : (req.headers['x-user-id'] || 'user-customer-demo');
}

ordersRouter.get('/', (req, res) => {
  const userId = getUserId(req);
  const orders = ordersService.getUserOrders(userId);
  res.json({ orders });
});

ordersRouter.get('/:id', (req, res) => {
  const order = ordersService.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({ order });
});

ordersRouter.post('/:id/cancel', (req, res) => {
  try {
    const userId = getUserId(req);
    const order = ordersService.cancelOrder(userId, req.params.id, req.body.reason);
    res.json({ success: true, order });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

ordersRouter.post('/:id/refund', (req, res) => {
  try {
    const userId = getUserId(req);
    const refund = ordersService.requestRefund(userId, req.params.id, req.body.reason);
    res.json({ success: true, refund });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});
