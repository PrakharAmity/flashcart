import { db } from '../db/index.js';

export const ordersService = {
  getUserOrders(userId) {
    return db.orders
      .filter((o) => o.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getOrderById(orderId) {
    return db.findOrderById(orderId);
  },

  cancelOrder(userId, orderId, reason = 'Customer request') {
    const order = db.findOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.userId !== userId) {
      const err = new Error('Unauthorized to cancel this order');
      err.statusCode = 403;
      throw err;
    }

    if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
      const err = new Error('Orders that are already shipped or delivered cannot be cancelled');
      err.statusCode = 400;
      throw err;
    }

    order.status = 'CANCELLED';
    order.cancellationReason = reason;
    order.updatedAt = new Date().toISOString();

    // Restock items
    for (const item of order.items) {
      const prod = db.findProductById(item.productId);
      if (prod) {
        prod.stock += item.quantity;
      }
    }

    db.addAuditLog({
      action: 'ORDER_CANCELLED',
      userId,
      role: 'CUSTOMER',
      details: { orderId: order.id, reason }
    });

    return order;
  },

  requestRefund(userId, orderId, reason) {
    const order = db.findOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.userId !== userId) {
      const err = new Error('Unauthorized to request refund for this order');
      err.statusCode = 403;
      throw err;
    }

    const existingRefund = db.refunds.find((r) => r.orderId === order.id);
    if (existingRefund) {
      const err = new Error('A refund has already been initiated for this order');
      err.statusCode = 400;
      throw err;
    }

    const refund = {
      id: `ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId: order.id,
      userId,
      amount: order.total,
      reason: reason || 'Return initiated by customer',
      status: 'PROCESSED',
      createdAt: new Date().toISOString()
    };

    db.refunds.push(refund);
    order.status = 'REFUNDED';
    order.updatedAt = new Date().toISOString();

    db.addAuditLog({
      action: 'REFUND_PROCESSED',
      userId,
      role: 'CUSTOMER',
      details: { orderId: order.id, refundId: refund.id, amount: refund.amount }
    });

    return refund;
  }
};
