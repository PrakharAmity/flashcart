import { db } from '../db/index.js';

export const cartService = {
  getCart(userId) {
    const rawItems = db.carts[userId] || [];
    const items = [];
    let subtotal = 0;

    for (const item of rawItems) {
      const prod = db.findProductById(item.productId);
      if (prod) {
        const itemTotal = prod.price * item.quantity;
        subtotal += itemTotal;
        items.push({
          productId: prod.id,
          title: prod.title,
          price: prod.price,
          originalPrice: prod.originalPrice,
          image: prod.images[0],
          quantity: item.quantity,
          stock: prod.stock,
          itemTotal
        });
      }
    }

    const discount = 0;
    const tax = Math.round(subtotal * 0.18);
    const deliveryFee = subtotal > 999 || subtotal === 0 ? 0 : 99;
    const total = subtotal + tax + deliveryFee;

    return {
      userId,
      items,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal,
      discount,
      tax,
      deliveryFee,
      total
    };
  },

  addToCart(userId, productId, quantity = 1) {
    const prod = db.findProductById(productId);
    if (!prod) {
      throw new Error(`Product ${productId} not found`);
    }

    if (!db.carts[userId]) {
      db.carts[userId] = [];
    }

    const existingIndex = db.carts[userId].findIndex((i) => i.productId === productId);
    const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);

    if (existingIndex > -1) {
      db.carts[userId][existingIndex].quantity += qtyToAdd;
    } else {
      db.carts[userId].push({
        productId,
        quantity: qtyToAdd,
        addedAt: new Date().toISOString()
      });
    }

    return this.getCart(userId);
  },

  updateQuantity(userId, productId, quantity) {
    if (!db.carts[userId]) return this.getCart(userId);
    const targetQty = parseInt(quantity, 10);

    if (targetQty <= 0) {
      return this.removeFromCart(userId, productId);
    }

    const item = db.carts[userId].find((i) => i.productId === productId);
    if (item) {
      item.quantity = targetQty;
    }

    return this.getCart(userId);
  },

  removeFromCart(userId, productId) {
    if (db.carts[userId]) {
      db.carts[userId] = db.carts[userId].filter((i) => i.productId !== productId);
    }
    return this.getCart(userId);
  },

  clearCart(userId) {
    db.carts[userId] = [];
    return this.getCart(userId);
  }
};
