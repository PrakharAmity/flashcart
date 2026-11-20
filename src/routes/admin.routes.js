import express from 'express';
import { adminService } from '../services/admin.service.js';

export const adminRouter = express.Router();

adminRouter.get('/metrics', (req, res) => {
  res.json(adminService.getPlatformMetrics());
});

adminRouter.get('/users', (req, res) => {
  res.json({ users: adminService.getAllUsers() });
});

adminRouter.get('/warehouses', (req, res) => {
  res.json({ warehouses: adminService.getAllWarehouses() });
});

adminRouter.get('/audit-logs', (req, res) => {
  res.json({ logs: adminService.getAuditLogs() });
});
