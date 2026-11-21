import { db } from '../db/index.js';
import { config } from '../config.js';

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
      await inventoryMutex.lock();
      try {
        const product = db.findProductById(productId);
        if (!product) {
          throw new Error(`Product not found: ${productId}`);
        }

        if (product.stock < qty) {
          throw new Error(`Out of stock. Only ${product.stock} units available for "${product.title}"`);
        }

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
      const product = db.findProductById(productId);
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      if (product.stock < qty) {
        throw new Error(`Out of stock. Only ${product.stock} units available for "${product.title}"`);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

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
