import { db } from '../db/index.js';
import { config } from '../config.js';
import { inventoryService } from './inventory.service.js';
import { warehouseService } from './warehouse.service.js';

const activeCheckoutLocks = new Set();
const completedIdempotentCheckouts = new Map();

export const checkoutService = {
  async placeOrder(userId, checkoutData, idempotencyKey = null) {
    const user = db.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const cartItems = db.carts[userId] || [];
    if (cartItems.length === 0) {
      throw new Error('Shopping cart is empty');
    }

    const effectiveKey = idempotencyKey || checkoutData.idempotencyKey || null;

    if (config.isReferenceMode) {
      if (effectiveKey && completedIdempotentCheckouts.has(effectiveKey)) {
        return completedIdempotentCheckouts.get(effectiveKey);
      }

      const lockKey = `checkout-${userId}`;
      if (activeCheckoutLocks.has(lockKey)) {
        const error = new Error('A checkout operation is already in progress. Please wait.');
        error.statusCode = 409;
        throw error;
      }

      activeCheckoutLocks.add(lockKey);

      try {
        let subtotal = 0;
        const orderItems = [];

        for (const item of cartItems) {
          const product = db.findProductById(item.productId);
          if (!product) {
            throw new Error(`Product ${item.productId} no longer exists`);
          }

          await inventoryService.reserveStock(product.id, item.quantity);

          const itemTotal = product.price * item.quantity;
          subtotal += itemTotal;

          orderItems.push({
            productId: product.id,
            title: product.title,
            price: product.price,
            quantity: item.quantity,
            image: product.images[0]
          });
        }

        const warehouseAllocations = warehouseService.allocateInventory(
          orderItems.map((oi) => ({ productId: oi.productId, quantity: oi.quantity }))
        );

        orderItems.forEach((oi) => {
          const alloc = warehouseAllocations.find((a) => a.productId === oi.productId);
          oi.warehouseAllocations = alloc ? alloc.allocations : [];
        });

        let discount = 0;
        let couponCode = checkoutData.couponCode || null;
        if (couponCode) {
          const coupon = db.coupons.find((c) => c.code.toUpperCase() === couponCode.toUpperCase());
          if (coupon && subtotal >= coupon.minOrderValue) {
            discount = Math.min(coupon.maxDiscount, Math.round((subtotal * coupon.discountPercent) / 100));
          } else {
            couponCode = null;
          }
        }

        const tax = Math.round((subtotal - discount) * 0.18);
        const deliveryFee = subtotal > 999 ? 0 : 99;
        const total = subtotal - discount + tax + deliveryFee;

        const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const orderNumber = `FC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

        const newOrder = {
          id: orderId,
          orderNumber,
          userId,
          items: orderItems,
          subtotal,
          tax,
          deliveryFee,
          discount,
          couponCode,
          total,
          status: 'PENDING_PAYMENT',
          shippingAddress: checkoutData.shippingAddress || db.addresses.find((a) => a.userId === userId) || null,
          paymentMethod: checkoutData.paymentMethod || 'UPI',
          idempotencyKey: effectiveKey,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.orders.unshift(newOrder);
        db.carts[userId] = [];

        db.addAuditLog({
          action: 'ORDER_PLACED',
          userId,
          role: user.role,
          details: { orderId: newOrder.id, orderNumber: newOrder.orderNumber, total: newOrder.total }
        });

        if (effectiveKey) {
          completedIdempotentCheckouts.set(effectiveKey, newOrder);
        }

        return newOrder;
      } finally {
        activeCheckoutLocks.delete(lockKey);
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 80));

      let subtotal = 0;
      const orderItems = [];

      for (const item of cartItems) {
        const product = db.findProductById(item.productId);
        if (!product) continue;

        await inventoryService.reserveStock(product.id, item.quantity);

        subtotal += product.price * item.quantity;
        orderItems.push({
          productId: product.id,
          title: product.title,
          price: product.price,
          quantity: item.quantity,
          image: product.images[0]
        });
      }

      const warehouseAllocations = warehouseService.allocateInventory(
        orderItems.map((oi) => ({ productId: oi.productId, quantity: oi.quantity }))
      );

      orderItems.forEach((oi) => {
        const alloc = warehouseAllocations.find((a) => a.productId === oi.productId);
        oi.warehouseAllocations = alloc ? alloc.allocations : [];
      });

      let discount = 0;
      let couponCode = checkoutData.couponCode || null;
      if (couponCode) {
        const coupon = db.coupons.find((c) => c.code.toUpperCase() === couponCode.toUpperCase());
        if (coupon && subtotal >= coupon.minOrderValue) {
          discount = Math.min(coupon.maxDiscount, Math.round((subtotal * coupon.discountPercent) / 100));
        } else {
          couponCode = null;
        }
      }

      const tax = Math.round((subtotal - discount) * 0.18);
      const deliveryFee = subtotal > 999 ? 0 : 99;
      const total = subtotal - discount + tax + deliveryFee;

      const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const orderNumber = `FC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      const newOrder = {
        id: orderId,
        orderNumber,
        userId,
        items: orderItems,
        subtotal,
        tax,
        deliveryFee,
        discount,
        couponCode,
        total,
        status: 'PENDING_PAYMENT',
        shippingAddress: checkoutData.shippingAddress || db.addresses.find((a) => a.userId === userId) || null,
        paymentMethod: checkoutData.paymentMethod || 'UPI',
        idempotencyKey: effectiveKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.orders.unshift(newOrder);
      db.carts[userId] = [];

      db.addAuditLog({
        action: 'ORDER_PLACED',
        userId,
        role: user.role,
        details: { orderId: newOrder.id, orderNumber: newOrder.orderNumber, total: newOrder.total }
      });

      return newOrder;
    }
  }
};
