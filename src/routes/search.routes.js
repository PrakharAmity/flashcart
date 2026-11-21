import express from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';

export const searchRouter = express.Router();

searchRouter.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const requestId = req.query.requestId || Date.now().toString();

  if (!q) {
    return res.json({
      query: '',
      requestId,
      total: 0,
      results: []
    });
  }

  if (!config.isReferenceMode && q.toLowerCase() === 'laptop') {
    await new Promise((resolve) => setTimeout(resolve, 3500));
  }

  const lowerQ = q.toLowerCase();
  const results = db.products.filter(
    (p) =>
      p.title.toLowerCase().includes(lowerQ) ||
      p.description.toLowerCase().includes(lowerQ) ||
      p.brand.toLowerCase().includes(lowerQ) ||
      p.categorySlug.toLowerCase().includes(lowerQ)
  );

  return res.json({
    query: q,
    requestId,
    total: results.length,
    results: results.slice(0, 15)
  });
});
