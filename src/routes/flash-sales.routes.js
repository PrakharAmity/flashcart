import express from 'express';
import { db } from '../db/index.js';

export const flashSalesRouter = express.Router();

flashSalesRouter.get('/', (req, res) => {
  const activeSale = db.flashSales.find((fs) => fs.isActive) || db.flashSales[0];
  const saleProducts = db.products.filter((p) => p.isFlashSale);
  res.json({
    campaign: activeSale,
    products: saleProducts
  });
});
