import express from 'express';
import { db } from '../db/index.js';

export const categoriesRouter = express.Router();

categoriesRouter.get('/', (req, res) => {
  res.json({ categories: db.categories });
});
