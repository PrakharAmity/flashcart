import express from 'express';
import { productsService } from '../services/products.service.js';

export const productsRouter = express.Router();

productsRouter.get('/', (req, res) => {
  const result = productsService.getProductsFiltered(req.query);
  res.json(result);
});

productsRouter.get('/trending', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 8;
  const trending = productsService.getTrendingProducts(limit);
  res.json({ trending });
});

productsRouter.get('/related/:id', (req, res) => {
  const related = productsService.getRelatedProducts(req.params.id);
  res.json({ related });
});

productsRouter.get('/:id', (req, res) => {
  const product = productsService.getProductById(req.params.id) || productsService.getProductBySlug(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ product });
});
