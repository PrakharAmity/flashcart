import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './src/config.js';
import { authRouter } from './src/routes/auth.routes.js';
import { productsRouter } from './src/routes/products.routes.js';
import { categoriesRouter } from './src/routes/categories.routes.js';
import { searchRouter } from './src/routes/search.routes.js';
import { cartRouter } from './src/routes/cart.routes.js';
import { checkoutRouter } from './src/routes/checkout.routes.js';
import { paymentsRouter } from './src/routes/payments.routes.js';
import { ordersRouter } from './src/routes/orders.routes.js';
import { sellerRouter } from './src/routes/seller.routes.js';
import { adminRouter } from './src/routes/admin.routes.js';
import { couponsRouter } from './src/routes/coupons.routes.js';
import { flashSalesRouter } from './src/routes/flash-sales.routes.js';
import { healthRouter } from './src/routes/health.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging for DEBUG//LAB diagnostic observability
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/search', searchRouter);
app.use('/api/cart', cartRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/admin', adminRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/flash-sales', flashSalesRouter);
app.use('/api/health', healthRouter);

// Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// SPA Fallback: support both root / and proxy paths /runtime/:id/preview/*
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Error] ${err.message}`, err.stack);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = config.port;
const HOST = config.host; // '0.0.0.0'

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`====================================================`);
    console.log(` FlashCart Server Running`);
    console.log(` Binding: http://${HOST}:${PORT}`);
    console.log(` Mode: ${config.isReferenceMode ? 'REFERENCE (Bugs Fixed)' : 'CHALLENGE (Intentional Bugs Active)'}`);
    console.log(` Demo Accounts:`);
    console.log(`   Customer: customer@flashcart.demo / FlashCart@123`);
    console.log(`   Seller:   seller@flashcart.demo / FlashCart@123`);
    console.log(`   Admin:    admin@flashcart.demo / FlashCart@123`);
    console.log(`====================================================`);
  });
}

export default app;
