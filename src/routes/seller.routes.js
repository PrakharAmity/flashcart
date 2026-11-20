import express from 'express';
import { sellersService } from '../services/sellers.service.js';

export const sellerRouter = express.Router();

function getSellerId(req) {
  // Demo seller fallback or derived
  return req.headers['x-seller-id'] || 'seller-1';
}

sellerRouter.get('/dashboard', (req, res) => {
  const sellerId = getSellerId(req);
  res.json(sellersService.getSellerDashboardMetrics(sellerId));
});

sellerRouter.get('/products', (req, res) => {
  const sellerId = getSellerId(req);
  res.json({ products: sellersService.getSellerProducts(sellerId) });
});

sellerRouter.post('/products', (req, res) => {
  try {
    const sellerId = getSellerId(req);
    const product = sellersService.createProduct(sellerId, req.body);
    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

sellerRouter.put('/products/:id', (req, res) => {
  try {
    const sellerId = getSellerId(req);
    const updated = sellersService.updateProduct(sellerId, req.params.id, req.body);
    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

sellerRouter.delete('/products/:id', (req, res) => {
  try {
    const sellerId = getSellerId(req);
    const result = sellersService.deleteProduct(sellerId, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
