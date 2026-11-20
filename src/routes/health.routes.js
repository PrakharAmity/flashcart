import express from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';

export const healthRouter = express.Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    applicationId: config.appId,
    applicationName: config.appName,
    referenceMode: config.isReferenceMode,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    stats: {
      products: db.products.length,
      users: db.users.length,
      orders: db.orders.length,
      warehouses: db.warehouses.length
    }
  });
});
