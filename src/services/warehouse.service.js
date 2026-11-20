import { db } from '../db/index.js';
import { config } from '../config.js';

export const warehouseService = {
  getWarehouses() {
    return db.warehouses;
  },

  getWarehouseInventory(warehouseId) {
    return db.warehouseInventory.filter((wi) => wi.warehouseId === warehouseId);
  },

  // DL-BUG-008: Incorrect Warehouse Inventory Allocation
  allocateInventory(items, orderId = null) {
    // items: Array of { productId, quantity }
    const allocations = [];

    for (const item of items) {
      const { productId, quantity } = item;
      const product = db.findProductById(productId);
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Find all warehouse inventory records for this product
      const inventories = db.warehouseInventory.filter((wi) => wi.productId === productId);

      if (config.isReferenceMode) {
        // REFERENCE FIX:
        // 1. Sort warehouses strictly by priority (1 is highest priority)
        const sortedInventories = [...inventories].sort((a, b) => {
          const whA = db.warehouses.find((w) => w.id === a.warehouseId);
          const whB = db.warehouses.find((w) => w.id === b.warehouseId);
          return (whA ? whA.priority : 99) - (whB ? whB.priority : 99);
        });

        // 2. Check total net available stock (stock - reservedStock)
        const totalNetAvailable = sortedInventories.reduce(
          (sum, inv) => sum + Math.max(0, inv.stock - inv.reservedStock),
          0
        );

        if (totalNetAvailable < quantity) {
          throw new Error(
            `Insufficient warehouse inventory for product "${product.title}". Requested: ${quantity}, Net Available: ${totalNetAvailable}`
          );
        }

        // 3. Allocate sequentially respecting reservations and priorities
        let remainingToAllocate = quantity;
        const itemAllocations = [];

        for (const inv of sortedInventories) {
          const availableInWh = Math.max(0, inv.stock - inv.reservedStock);
          if (availableInWh <= 0) continue;

          const take = Math.min(remainingToAllocate, availableInWh);
          inv.reservedStock += take;
          remainingToAllocate -= take;

          itemAllocations.push({
            warehouseId: inv.warehouseId,
            quantity: take
          });

          // Create an inventory reservation record
          db.inventoryReservations.push({
            id: `res-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            orderId: orderId || 'pending-order',
            productId,
            warehouseId: inv.warehouseId,
            quantity: take,
            status: 'RESERVED',
            createdAt: new Date().toISOString()
          });

          if (remainingToAllocate === 0) break;
        }

        allocations.push({
          productId,
          title: product.title,
          requestedQuantity: quantity,
          allocations: itemAllocations,
          isFulfilled: remainingToAllocate === 0
        });
      } else {
        // CHALLENGE BUG DL-BUG-008:
        // Flawed greedy allocation:
        // 1. Checks raw 'stock' instead of available stock (ignoring existing reservedStock!)
        // 2. Sorts warehouses arbitrarily or picks single warehouse without splitting,
        // resulting in over-allocation of reserved stock or failing valid fulfillments.
        const buggySorted = [...inventories].sort((a, b) => b.stock - a.stock);

        let remaining = quantity;
        const itemAllocations = [];

        for (const inv of buggySorted) {
          // Bug: uses raw stock without considering reservedStock
          if (inv.stock <= 0) continue;

          const take = Math.min(remaining, inv.stock);
          // Bug: does not properly update reservedStock or over-allocates beyond net capacity
          inv.stock = Math.max(0, inv.stock - take);
          remaining -= take;

          itemAllocations.push({
            warehouseId: inv.warehouseId,
            quantity: take
          });

          if (remaining === 0) break;
        }

        allocations.push({
          productId,
          title: product.title,
          requestedQuantity: quantity,
          allocations: itemAllocations,
          isFulfilled: remaining === 0
        });
      }
    }

    return allocations;
  }
};
