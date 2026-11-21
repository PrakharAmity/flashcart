import express from 'express';
import { paymentsService } from '../services/payments.service.js';

export const paymentsRouter = express.Router();

paymentsRouter.post('/process', async (req, res) => {
  try {
    const { orderId, method, simulatedOutcome } = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
    const result = await paymentsService.processPayment(orderId, {
      method,
      simulatedOutcome: simulatedOutcome || 'SUCCESS',
      idempotencyKey
    });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

paymentsRouter.get('/verify/:orderId', (req, res) => {
  const result = paymentsService.verifyPayment(req.params.orderId, req.query.status || req.query.redirectStatus);
  res.json(result);
});

paymentsRouter.get('/order/:orderId', (req, res) => {
  const payment = paymentsService.getPaymentByOrderId(req.params.orderId);
  if (!payment) {
    return res.status(404).json({ error: 'Payment record not found' });
  }
  res.json({ payment });
});
