import { db } from '../db/index.js';

export const adminService = {
  getPlatformMetrics() {
    const totalUsers = db.users.length;
    const activeCustomers = db.users.filter((u) => u.role === 'CUSTOMER').length;
    const registeredSellers = db.sellers.length;
    const totalProducts = db.products.length;
    const totalOrders = db.orders.length;
    const grossRevenue = db.orders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.total, 0);
    const activeFlashSales = db.flashSales.filter((fs) => fs.isActive).length;
    const pendingRefunds = db.refunds.filter((r) => r.status === 'REQUESTED').length;

    return {
      totalUsers,
      activeCustomers,
      registeredSellers,
      totalProducts,
      totalOrders,
      grossRevenue,
      activeFlashSales,
      pendingRefunds,
      warehousesCount: db.warehouses.length,
      auditLogsCount: db.auditLogs.length
    };
  },

  getAllUsers() {
    return db.users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      phone: u.phone,
      status: u.status,
      createdAt: u.createdAt
    }));
  },

  getAllWarehouses() {
    return db.warehouses.map((wh) => {
      const items = db.warehouseInventory.filter((wi) => wi.warehouseId === wh.id);
      const totalStock = items.reduce((sum, i) => sum + i.stock, 0);
      const totalReserved = items.reduce((sum, i) => sum + i.reservedStock, 0);
      return {
        ...wh,
        totalStock,
        totalReserved,
        utilizationRate: Math.round((totalStock / wh.capacity) * 100)
      };
    });
  },

  getAuditLogs(limit = 50) {
    return db.auditLogs.slice(0, limit);
  }
};
