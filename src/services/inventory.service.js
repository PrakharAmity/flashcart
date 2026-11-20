import { db } from '../db/index.js';
import { config } from '../config.js';

// Mutex lock for thread-safe sequential operations in Node.js
class Mutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  lock() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  unlock() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next();
    } else {
      this._locked = false;
    }
  }
}

const inventoryMutex = new Mutex();

export const inventoryService = {
  async reserveStock(productId, quantity) {
    const qty = parseInt(quantity, 10) || 1;

    if (config.isReferenceMode) {
      // REFERENCE FIX (DL-BUG-003):
      // Strict atomic critical section locking prevents race condition
      await inventoryMutex.lock();
      try {
        const product = db.findProductById(productId);
        if (!product) {
          throw new Error(`Product not found: ${productId}`);
        }

        if (product.stock < qty) {
          throw new Error(`Out of stock. Only ${product.stock} units available for "${product.title}"`);
        }

        // Atomically decrement
        product.stock -= qty;

        return {
          success: true,
          productId,
          reservedQuantity: qty,
          remainingStock: product.stock
        };
      } finally {
        inventoryMutex.unlock();
      }
    } else {
      // CHALLENGE BUG DL-BUG-003:
      // Non-atomic read-then-write:
      // Check happens first, then an asynchronous gap (e.g. database query / external validation)
      // occurs before decrementing. When 2 concurrent requests hit this simultaneously,
      // both read stock = 1, pass the check, and both decrement, causing overselling!
      const product = db.findProductById(productId);
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Check stock
      if (product.stock < qty) {
        throw new Error(`Out of stock. Only ${product.stock} units available for "${product.title}"`);
      }

      // Vulnerable async gap
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Decrement without lock (causes negative stock or double deduction)
      product.stock -= qty;

      return {
        success: true,
        productId,
        reservedQuantity: qty,
        remainingStock: product.stock
      };
    }
  },

  releaseStock(productId, quantity) {
    const qty = parseInt(quantity, 10) || 1;
    const product = db.findProductById(productId);
    if (product) {
      product.stock += qty;
    }
  }
};
