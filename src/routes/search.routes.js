import express from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';

export const searchRouter = express.Router();

searchRouter.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const requestId = req.query.requestId || Date.now().toString();

  // If query is empty
  if (!q) {
    return res.json({
      query: '',
      requestId,
      total: 0,
      results: []
    });
  }

  // Artificial latency simulation to reproduce race condition when "laptop" is queried before "mobile"
  // In Challenge Mode, specific queries have varied delay to test race condition
  if (!config.isReferenceMode && q.toLowerCase() === 'laptop') {
    // Slower query to allow subsequent "mobile" query to return earlier
    await new Promise((resolve) => setTimeout(resolve, 150));
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
