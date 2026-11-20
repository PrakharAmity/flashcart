import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { config } from '../src/config.js';
import { checkoutService } from '../src/services/checkout.service.js';
import { inventoryService } from '../src/services/inventory.service.js';
import { paymentsService } from '../src/services/payments.service.js';
import { productsService, computeProductScore, PriorityQueueHeap } from '../src/services/products.service.js';
import { warehouseService } from '../src/services/warehouse.service.js';
import { authService } from '../src/services/auth.service.js';

export const tests = {
  // DL-BUG-001: Duplicate Checkout Requests
  async test_dl_bug_001_duplicate_checkout_requests() {
    db.reset();
    const userId = 'user-customer-demo';
    db.carts[userId] = [
      { productId: 'prod-fash-01', quantity: 1, addedAt: new Date().toISOString() }
    ];

    const idempotencyKey = `test-idemp-${Date.now()}`;
    const initialOrderCount = db.orders.length;

    // Simulate two rapid checkout submissions
    const promise1 = checkoutService.placeOrder(userId, { paymentMethod: 'UPI' }, idempotencyKey);
    const promise2 = checkoutService.placeOrder(userId, { paymentMethod: 'UPI' }, idempotencyKey);

    const results = await Promise.allSettled([promise1, promise2]);
    const successful = results.filter((r) => r.status === 'fulfilled');

    // Expected: Exactly 1 new order should be created (or second returns same order)
    const newOrders = db.orders.slice(0, db.orders.length - initialOrderCount);
    const uniqueOrders = new Set(newOrders.map((o) => o.id));

    if (uniqueOrders.size > 1) {
      throw new Error(`Duplicate orders created for single checkout: created ${uniqueOrders.size} separate orders.`);
    }

    assert.ok(successful.length >= 1, 'At least one checkout submission must succeed.');
  },

  // DL-BUG-002: Stale Product Search Responses
  async test_dl_bug_002_stale_search_responses() {
    db.reset();
    let latestVisibleResults = null;
    let latestQueryIssued = '';
    let lastRequestId = 0;

    // Simulate issuing query 1 ('laptop') with high latency
    lastRequestId++;
    const reqId1 = lastRequestId;
    latestQueryIssued = 'laptop';

    // In Challenge Mode, laptop is delayed by 150ms
    const query1Promise = (async () => {
      const q = 'laptop';
      if (!config.isReferenceMode) {
        await new Promise((r) => setTimeout(r, 150));
      }
      const results = db.products.filter((p) => p.categorySlug.includes(q) || p.title.toLowerCase().includes(q));
      return { query: q, requestId: reqId1, results };
    })();

    // Quickly issue query 2 ('mobile') which returns faster
    lastRequestId++;
    const reqId2 = lastRequestId;
    latestQueryIssued = 'mobile';

    const query2Promise = (async () => {
      const q = 'mobile';
      const results = db.products.filter((p) => p.categorySlug.includes(q) || p.title.toLowerCase().includes(q));
      return { query: q, requestId: reqId2, results };
    })();

    // Handle incoming responses
    const handleResponse = (data) => {
      if (config.isReferenceMode) {
        // Discard if older than latest
        if (data.requestId < lastRequestId) return;
      }
      latestVisibleResults = data;
    };

    // query2 finishes first
    const res2 = await query2Promise;
    handleResponse(res2);

    // query1 finishes later
    const res1 = await query1Promise;
    handleResponse(res1);

    if (latestVisibleResults.query !== 'mobile') {
      throw new Error(
        `Stale search response for '${latestVisibleResults.query}' overwrote newer query 'mobile'. Visible query: '${latestVisibleResults.query}'`
      );
    }

    assert.strictEqual(latestVisibleResults.query, 'mobile', 'Only latest search query results should be visible.');
  },

  // DL-BUG-003: Concurrent Inventory Overselling
  async test_dl_bug_003_concurrent_inventory_overselling() {
    db.reset();
    const testProduct = db.findProductById('prod-cam-04');
    assert.ok(testProduct, 'Test product must exist');

    // Force stock to exactly 1
    testProduct.stock = 1;

    // Launch two concurrent reservation attempts for quantity 1
    const task1 = inventoryService.reserveStock(testProduct.id, 1);
    const task2 = inventoryService.reserveStock(testProduct.id, 1);

    const outcomes = await Promise.allSettled([task1, task2]);
    const succeeded = outcomes.filter((o) => o.status === 'fulfilled');
    const failed = outcomes.filter((o) => o.status === 'rejected');

    if (testProduct.stock < 0) {
      throw new Error(`Inventory stock dropped below zero: ${testProduct.stock}`);
    }

    if (succeeded.length > 1) {
      throw new Error(`Oversold inventory: ${succeeded.length} reservations succeeded when only 1 item was in stock.`);
    }

    assert.strictEqual(succeeded.length, 1, 'Exactly one reservation must succeed when stock is 1.');
    assert.strictEqual(failed.length, 1, 'Subsequent concurrent reservation must fail with out of stock.');
    assert.strictEqual(testProduct.stock, 0, 'Final stock must be exactly 0.');
  },

  // DL-BUG-004: Duplicate Payment Transactions
  async test_dl_bug_004_duplicate_payment_transactions() {
    db.reset();
    const order = db.orders.find((o) => o.status === 'PENDING_PAYMENT') || db.orders[0];
    order.status = 'PENDING_PAYMENT';

    // Clear any existing payments for this order
    db.payments = db.payments.filter((p) => p.orderId !== order.id);

    // Initial valid payment
    const firstResult = await paymentsService.processPayment(order.id, {
      method: 'UPI',
      simulatedOutcome: 'SUCCESS',
      idempotencyKey: 'idemp-pay-1'
    });

    assert.strictEqual(firstResult.payment.status, 'SUCCESS', 'First payment should succeed.');

    // Attempt second payment on the same settled order (e.g. customer retry)
    let duplicateAccepted = false;
    try {
      const secondResult = await paymentsService.processPayment(order.id, {
        method: 'UPI',
        simulatedOutcome: 'SUCCESS',
        idempotencyKey: 'idemp-pay-2'
      });
      if (secondResult && !secondResult.isDuplicate) {
        duplicateAccepted = true;
      }
    } catch (err) {
      // Expected: rejection of payment for already paid order
      duplicateAccepted = false;
    }

    const successfulPaymentsForOrder = db.payments.filter(
      (p) => p.orderId === order.id && p.status === 'SUCCESS'
    );

    if (successfulPaymentsForOrder.length > 1 || duplicateAccepted) {
      throw new Error(
        `Duplicate payment transactions created: found ${successfulPaymentsForOrder.length} successful payment records for order ${order.orderNumber}.`
      );
    }

    assert.strictEqual(successfulPaymentsForOrder.length, 1, 'Only one successful payment transaction should exist per order.');
  },

  // DL-BUG-005: Incorrect Product Ranking Heap
  async test_dl_bug_005_product_ranking_heap() {
    db.reset();

    // Create test products with very close scores to test comparator accuracy & tie-breaker
    const trending = productsService.getTrendingProducts(10);
    assert.ok(trending.length >= 5, 'Trending products must return at least 5 items.');

    // Verify monotonic descending order of computed scores
    for (let i = 0; i < trending.length - 1; i++) {
      const current = trending[i];
      const next = trending[i + 1];

      const scoreA = computeProductScore(current);
      const scoreB = computeProductScore(next);

      if (scoreA < scoreB) {
        throw new Error(
          `Priority Queue Heap ordering error at index ${i}: "${current.title}" (score ${scoreA}) ranked above "${next.title}" (score ${scoreB}).`
        );
      }
    }
  },

  // DL-BUG-006: Incorrect Combined Filters and Pagination
  async test_dl_bug_006_combined_filters_and_pagination() {
    db.reset();

    // Query all items matching category 'audio'
    const fullAudioFilter = productsService.getProductsFiltered({
      category: 'audio',
      page: 1,
      limit: 100
    });
    const totalMatching = fullAudioFilter.products.length;
    assert.ok(totalMatching >= 6, 'Should have at least 6 audio items in seed dataset.');

    // Now query page 1 and page 2 with limit = 3
    const page1 = productsService.getProductsFiltered({ category: 'audio', page: 1, limit: 3 });
    const page2 = productsService.getProductsFiltered({ category: 'audio', page: 2, limit: 3 });

    const totalCollected = page1.products.length + page2.products.length;
    const idsPage1 = new Set(page1.products.map((p) => p.id));
    const overlap = page2.products.some((p) => idsPage1.has(p.id));

    if (overlap) {
      throw new Error('Pagination error: Products duplicated across consecutive pages.');
    }

    if (totalCollected !== 6) {
      throw new Error(
        `Combined filtering & pagination error: Expected 6 items across pages 1 & 2, but collected ${totalCollected} items.`
      );
    }

    assert.strictEqual(page1.pagination.totalItems, totalMatching, 'Pagination totalItems must reflect total filtered matching items.');
  },

  // DL-BUG-007: False Payment Success Screen
  async test_dl_bug_007_false_payment_success_screen() {
    db.reset();

    // Identify an unpaid/pending order
    const pendingOrder = db.orders.find((o) => o.status === 'PENDING_PAYMENT') || db.orders[0];
    pendingOrder.status = 'PENDING_PAYMENT';
    // Ensure no SUCCESS payment exists
    db.payments = db.payments.filter((p) => p.orderId !== pendingOrder.id || p.status !== 'SUCCESS');

    // Simulate returning from gateway with unverified redirect query status=success
    const verification = paymentsService.verifyPayment(pendingOrder.id, 'success');

    if (verification.verified === true) {
      throw new Error(
        `Security verification flaw: Order ${pendingOrder.orderNumber} in PENDING_PAYMENT state falsely confirmed as successful based on unverified redirect parameter.`
      );
    }

    assert.strictEqual(verification.verified, false, 'Unpaid order must not verify as SUCCESS.');
  },

  // DL-BUG-008: Incorrect Warehouse Inventory Allocation
  async test_dl_bug_008_warehouse_inventory_allocation() {
    db.reset();
    const product = db.products[0];

    // Setup warehouse inventory with existing reservations on primary warehouse wh-1
    const wh1Inv = db.warehouseInventory.find((wi) => wi.warehouseId === 'wh-1' && wi.productId === product.id);
    assert.ok(wh1Inv, 'Warehouse 1 inventory record must exist.');

    // Artificially reserve all stock in wh-1
    wh1Inv.reservedStock = wh1Inv.stock; // 0 available in wh-1!

    // Now request allocation for quantity 2
    const allocations = warehouseService.allocateInventory([
      { productId: product.id, quantity: 2 }
    ]);

    const allocatedWarehouses = allocations[0].allocations;
    const allocatedFromWh1 = allocatedWarehouses.find((a) => a.warehouseId === 'wh-1');

    if (allocatedFromWh1 && allocatedFromWh1.quantity > 0) {
      throw new Error(
        `Warehouse allocation error: Allocated ${allocatedFromWh1.quantity} units from WH-1 which has 0 available unreserved units.`
      );
    }

    assert.strictEqual(allocations[0].isFulfilled, true, 'Allocation must fulfill from other available warehouses.');
  }
};
