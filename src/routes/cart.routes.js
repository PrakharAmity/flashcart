import express from 'express';
import { cartService } from '../services/cart.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const cartRouter = express.Router();

// Allow demo user fallback or authenticated user
function getUserId(req) {
  return req.user ? req.user.id : (req.headers['x-user-id'] || 'user-customer-demo');
}

cartRouter.get('/', (req, res) => {
  const userId = getUserId(req);
  res.json(cartService.getCart(userId));
});

cartRouter.post('/add', (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId, quantity } = req.body;
    const cart = cartService.addToCart(userId, productId, quantity);
    res.json(cart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

cartRouter.put('/update', (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId, quantity } = req.body;
    const cart = cartService.updateQuantity(userId, productId, quantity);
    res.json(cart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

cartRouter.delete('/remove/:productId', (req, res) => {
  try {
    const userId = getUserId(req);
    const cart = cartService.removeFromCart(userId, req.params.productId);
    res.json(cart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

cartRouter.delete('/clear', (req, res) => {
  const userId = getUserId(req);
  res.json(cartService.clearCart(userId));
});
