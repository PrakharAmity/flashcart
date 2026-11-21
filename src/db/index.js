import fs from 'node:fs';
import path from 'node:path';
import {
  seedCategories,
  seedUsers,
  seedSellers,
  seedWarehouses,
  seedAddresses,
  seedProducts,
  seedCoupons,
  seedFlashSales
} from './seed-data.js';

class FlashCartDatabase {
  constructor() {
    this.reset();
  }

  reset() {
    this.categories = JSON.parse(JSON.stringify(seedCategories));
    this.users = JSON.parse(JSON.stringify(seedUsers));
    this.sellers = JSON.parse(JSON.stringify(seedSellers));
    this.warehouses = JSON.parse(JSON.stringify(seedWarehouses));
    this.addresses = JSON.parse(JSON.stringify(seedAddresses));
    this.products = JSON.parse(JSON.stringify(seedProducts));
    this.coupons = JSON.parse(JSON.stringify(seedCoupons));
    this.flashSales = JSON.parse(JSON.stringify(seedFlashSales));

    // Carts: map of userId -> array of items
    this.carts = {
      'user-customer-demo': [
        {
          productId: 'prod-aud-08',
          quantity: 1,
          addedAt: '2026-11-20T10:00:00Z'
        },
        {
          productId: 'prod-wear-01',
          quantity: 1,
          addedAt: '2026-11-20T10:05:00Z'
        },
        {
          productId: 'prod-fash-01',
          quantity: 1,
          addedAt: '2026-11-20T10:10:00Z'
        }
      ]
    };

    // Wishlists: map of userId -> array of productIds
    this.wishlists = {
      'user-customer-demo': ['prod-mob-01', 'prod-lap-01', 'prod-game-01']
    };

    // Generate Warehouse Inventories
    this.warehouseInventory = [];
    this.products.forEach((prod) => {
      // Allocate inventory across the 5 warehouses
      // wh-1 (Mumbai): 40%
      // wh-2 (Delhi): 30%
      // wh-3 (Bengaluru): 15%
      // wh-4 (Kolkata): 10%
      // wh-5 (Chennai): 5%
      const total = prod.stock;
      const q1 = Math.max(1, Math.floor(total * 0.4));
      const q2 = Math.max(1, Math.floor(total * 0.3));
      const q3 = Math.max(1, Math.floor(total * 0.15));
      const q4 = Math.max(0, Math.floor(total * 0.1));
      const q5 = Math.max(0, total - (q1 + q2 + q3 + q4));

      const distribution = [
        { warehouseId: 'wh-1', stock: q1 },
        { warehouseId: 'wh-2', stock: q2 },
        { warehouseId: 'wh-3', stock: q3 },
        { warehouseId: 'wh-4', stock: q4 },
        { warehouseId: 'wh-5', stock: q5 }
      ];

      distribution.forEach((d) => {
        this.warehouseInventory.push({
          id: `wi-${d.warehouseId}-${prod.id}`,
          warehouseId: d.warehouseId,
          productId: prod.id,
          stock: d.stock,
          reservedStock: 0
        });
      });
    });

    this.inventoryReservations = [];

    // 20 Sample Orders
    this.orders = [];
    this.payments = [];
    this.paymentAttempts = [];
    this.refunds = [];
    this.auditLogs = [];

    this._seedHistoricalOrders();
  }

  _seedHistoricalOrders() {
    const statuses = ['DELIVERED', 'SHIPPED', 'PROCESSING', 'PENDING_PAYMENT', 'DELIVERED'];
    for (let i = 1; i <= 20; i++) {
      const orderId = `ord-2026-${String(i).padStart(4, '0')}`;
      const status = statuses[i % statuses.length];
      const prod = this.products[(i * 3) % this.products.length];
      const qty = (i % 2) + 1;
      const subtotal = prod.price * qty;
      const tax = Math.round(subtotal * 0.18);
      const deliveryFee = subtotal > 999 ? 0 : 99;
      const total = subtotal + tax + deliveryFee;

      const order = {
        id: orderId,
        orderNumber: `FC-2026-${10000 + i}`,
        userId: i <= 5 ? 'user-customer-demo' : `user-customer-${(i % 18) + 2}`,
        items: [
          {
            productId: prod.id,
            title: prod.title,
            price: prod.price,
            quantity: qty,
            image: prod.images[0],
            warehouseAllocations: [
              { warehouseId: 'wh-1', quantity: qty }
            ]
          }
        ],
        subtotal,
        tax,
        deliveryFee,
        discount: 0,
        couponCode: null,
        total,
        status,
        shippingAddress: {
          recipientName: 'Alex Morgan',
          phone: '+91 98765 43210',
          street: '742 Innovation Boulevard, Suite 400',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560100',
          country: 'India'
        },
        paymentMethod: i % 2 === 0 ? 'UPI' : 'CREDIT_CARD',
        createdAt: new Date(Date.now() - (21 - i) * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - (21 - i) * 86400000).toISOString()
      };

      this.orders.push(order);

      // Payment for each order
      const paymentStatus = status === 'PENDING_PAYMENT' ? 'PENDING' : 'SUCCESS';
      const payment = {
        id: `pay-${orderId}`,
        orderId,
        userId: order.userId,
        amount: total,
        method: order.paymentMethod,
        status: paymentStatus,
        transactionId: `TXN-${1000000 + i}`,
        createdAt: order.createdAt
      };
      this.payments.push(payment);

      this.paymentAttempts.push({
        id: `pa-${orderId}-1`,
        paymentId: payment.id,
        orderId,
        attemptNumber: 1,
        status: paymentStatus,
        idempotencyKey: `idemp-${orderId}-1`,
        gatewayRef: `GW-REF-${1000000 + i}`,
        createdAt: order.createdAt
      });

      this.auditLogs.push({
        id: `audit-seed-ord-${orderId}`,
        timestamp: order.createdAt,
        action: 'ORDER_PLACED',
        userId: order.userId,
        role: 'CUSTOMER',
        details: { orderId: order.id, orderNumber: order.orderNumber, total: order.total }
      });

      if (paymentStatus === 'SUCCESS') {
        this.auditLogs.push({
          id: `audit-seed-pay-${orderId}`,
          timestamp: payment.createdAt,
          action: 'PAYMENT_SUCCESS',
          userId: order.userId,
          role: 'CUSTOMER',
          details: { orderId: order.id, transactionId: payment.transactionId, amount: total, method: order.paymentMethod }
        });
      }

      // Sample refund for 1 order
      if (i === 4) {
        this.refunds.push({
          id: `ref-001`,
          orderId,
          userId: order.userId,
          amount: total,
          reason: 'Customer initiated return within 7-day policy',
          status: 'PROCESSED',
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
        });
      }
    }
  }

  // Helper methods
  findUserByEmail(email) {
    if (!email) return null;
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id) {
    return this.users.find((u) => u.id === id);
  }

  findProductById(id) {
    return this.products.find((p) => p.id === id);
  }

  findProductBySlug(slug) {
    return this.products.find((p) => p.slug === slug);
  }

  findOrderById(id) {
    return this.orders.find((o) => o.id === id || o.orderNumber === id);
  }

  findPaymentByOrderId(orderId) {
    return this.payments.find((p) => p.orderId === orderId);
  }

  addAuditLog(entry) {
    this.auditLogs.unshift({
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry
    });
  }
}

export const db = new FlashCartDatabase();
