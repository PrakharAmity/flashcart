# FlashCart — Technical Solutions & Code Implementation Guide

This guide provides the exact lines of code, file locations, root cause mechanics, and proof of fix for all 8 production bugs in FlashCart (`DL-APP-001`).

---

## Summary Matrix: Files & Exact Lines to Modify

| Bug ID | Title | File to Modify | Target Lines to Change | Core Mechanism |
|---|---|---|---|---|
| **DL-BUG-001** | Duplicate Checkout Requests | `src/services/checkout.service.js` | Lines 7–8 & Lines 135–200 | Per-User Mutex Lock + Idempotency Cache |
| **DL-BUG-002** | Stale Product Search Responses | `public/app.js` & `src/routes/search.routes.js` | `app.js`: Lines 705–711<br>`search.routes.js`: Lines 21–26 | Sequence ID Ordering & Discard Stale Responses |
| **DL-BUG-003** | Concurrent Inventory Overselling | `src/services/inventory.service.js` | Lines 5–32 & Lines 64–93 | Atomic Mutex Lock around Stock Reservation |
| **DL-BUG-004** | Duplicate Payment Transactions | `src/services/payments.service.js` | Lines 144–185 | Check Existing Settled Payments (`status === 'SUCCESS'`) |
| **DL-BUG-005** | Incorrect Product Ranking Heap | `src/services/products.service.js` | Lines 136–152 | Max-Heap Comparator (`a - b`) + Tie-Breaker |
| **DL-BUG-006** | Broken Filtered Pagination | `src/services/products.service.js` | Lines 235–275 | Filter Complete Array First, Then Slice for Page |
| **DL-BUG-007** | False Payment Success Screen | `src/services/payments.service.js` | Lines 16–30 | Query Database Payment Record, Ignore URL Params |
| **DL-BUG-008** | Depleted Warehouse Allocation | `src/services/warehouse.service.js` | Lines 87–125 | Net Available Stock (`stock - reservedStock`) + Priority Sort |

---

## 1. DL-BUG-001: Duplicate Checkout Requests on Double-Click

### Affected File
- [src/services/checkout.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/checkout.service.js)

### Lines of Code to Add at Top of File (Lines 6–8)
Make sure the in-memory sets and maps are declared at module scope:
```javascript
// src/services/checkout.service.js (Lines 6–8)
const activeCheckoutLocks = new Set();
const completedIdempotentCheckouts = new Map();
```

### Lines of Code to Replace in `placeOrder()` (Replace Lines 135–200)
**Remove this buggy code:**
```javascript
// BUGGY CODE (Lines 135-141): No locking, no idempotency check
await new Promise((resolve) => setTimeout(resolve, 80));

let subtotal = 0;
const orderItems = [];
// ... creates duplicate orders when called concurrently
```

**Replace with the reference fix (Lines 24–41 & 127–134):**
```javascript
// src/services/checkout.service.js
// 1. Check idempotency cache first
if (effectiveKey && completedIdempotentCheckouts.has(effectiveKey)) {
  return completedIdempotentCheckouts.get(effectiveKey);
}

// 2. Lock user's checkout session to prevent concurrent double-click
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
    if (!product) throw new Error(`Product ${item.productId} no longer exists`);

    // Atomically reserve stock
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

  // Create order...
  // Clear cart...
  db.carts[userId] = [];

  if (effectiveKey) {
    completedIdempotentCheckouts.set(effectiveKey, newOrder);
  }

  return newOrder;
} finally {
  // Always release the lock
  activeCheckoutLocks.delete(lockKey);
}
```

### Visual Proof & Test
- **Screenshot:** [DL-BUG-001/screenshot-01.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-001/screenshot-01.png) shows the duplicate order rows tagged with `⚠️ Duplicate Order #1` and `⚠️ Duplicate Order #2`.
- **Automated Test:** Run `npm run test:reference` — `test_dl_bug_001_duplicate_checkout_requests` passes in `3ms`.

---

## 2. DL-BUG-002: Stale Product Search Responses Overwrite Query

### Affected Files
1. [public/app.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/public/app.js)
2. [src/routes/search.routes.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/routes/search.routes.js)

### Lines of Code to Change in `public/app.js` (Lines 705–711)
**Remove this buggy toggle:**
```javascript
// BUGGY CODE (Lines 706-710): Only checks sequence when isReferenceMode is true
const isReferenceMode = window.IS_REFERENCE_MODE === true;
if (isReferenceMode && Number(data.requestId) < state.lastSearchRequestId) {
  return;
}
```

**Replace with unconditional sequence check:**
```javascript
// FIXED CODE: Always discard stale responses whose requestId is older than latest
if (Number(data.requestId) < state.lastSearchRequestId) {
  return; // Discard stale out-of-order response!
}
```

### Lines of Code to Change in `src/routes/search.routes.js` (Lines 21–26)
**Remove the artificial race-condition delay:**
```javascript
// Remove or delete lines 23-25:
// if (!config.isReferenceMode && q.toLowerCase() === 'laptop') {
//   await new Promise((resolve) => setTimeout(resolve, 3500));
// }
```

### Visual Proof & Test
- **Screenshots:**
  - [DL-BUG-002/screenshot-01.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-002/screenshot-01.png) shows the fast query "mobile" rendering first.
  - [DL-BUG-002/screenshot-02.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-002/screenshot-02.png) shows the stale "laptop" search results overwriting the active "mobile" search.
- **Automated Test:** `test_dl_bug_002_stale_search_responses` verifies out-of-order responses are rejected.

---

## 3. DL-BUG-003: Concurrent Inventory Overselling During Flash Sale

### Affected File
- [src/services/inventory.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/inventory.service.js)

### Mutex Class at Top of File (Lines 5–32)
Ensure the Mutex queue is defined and instantiated:
```javascript
// src/services/inventory.service.js (Lines 5-32)
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
      this._queue.shift()();
    } else {
      this._locked = false;
    }
  }
}

const inventoryMutex = new Mutex();
```

### Lines of Code to Replace in `reserveStock()` (Lines 64–93)
**Remove this buggy non-atomic code:**
```javascript
// BUGGY CODE (Lines 65-92): Read-then-write race condition
const product = db.findProductById(productId);
if (product.stock < qty) throw new Error('Out of stock');

// Vulnerable async gap allows another request to read stock before decrement!
await new Promise((resolve) => setTimeout(resolve, 50));

product.stock -= qty; // Oversells inventory into negative numbers!
```

**Replace with the atomic critical section (Lines 38–63):**
```javascript
// FIXED CODE:
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
```

### Visual Proof & Test
- **Screenshots:**
  - [DL-BUG-003/screenshot-01.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-01.png) & [screenshot-03.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-03.png): Customer A buying the last Nikon Z8.
  - [DL-BUG-003/screenshot-02.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-02.png) & [screenshot-04.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-04.png): Customer B concurrently checking out and also being accepted!
  - [DL-BUG-003/screenshot-05.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-05.png): Nikon Z8 catalog modal showing `Backordered (-1 units)`.
- **Automated Test:** `test_dl_bug_003_concurrent_inventory_overselling` ensures stock never drops below 0.

---

## 4. DL-BUG-004: Duplicate Payment Transactions on Retry

### Affected File
- [src/services/payments.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/payments.service.js)

### Lines of Code to Replace in `processPayment()` (Lines 144–185)
**Remove this buggy code:**
```javascript
// BUGGY CODE (Lines 145-165): Always creates a new SUCCESS transaction without checking
const isSuccess = simulatedOutcome === 'SUCCESS';
const paymentRecord = {
  id: paymentId,
  orderId: order.id,
  status: isSuccess ? 'SUCCESS' : 'FAILED',
  transactionId: txnId,
  // ...
};
db.payments.push(paymentRecord); // Customer charged twice!
```

**Replace with the settled check (Lines 68–94):**
```javascript
// FIXED CODE:
// 1. Reject payment if order is already settled
const existingSuccess = db.payments.find(
  (p) => p.orderId === order.id && p.status === 'SUCCESS'
);

if (existingSuccess) {
  const error = new Error(`Order ${order.orderNumber} has already been paid successfully.`);
  error.statusCode = 400;
  error.existingTransactionId = existingSuccess.transactionId;
  throw error;
}

// 2. Check idempotency key among payment attempts
if (idempotencyKey) {
  const existingAttempt = db.paymentAttempts.find(
    (pa) => pa.idempotencyKey === idempotencyKey
  );
  if (existingAttempt) {
    const matchedPayment = db.payments.find((p) => p.id === existingAttempt.paymentId);
    return {
      payment: matchedPayment,
      attempt: existingAttempt,
      isDuplicate: true
    };
  }
}
```

### Visual Proof & Test
- **Screenshots:**
  - [DL-BUG-004/screenshot-01.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-004/screenshot-01.png): "Retry Payment" button remains active after successful payment.
  - [DL-BUG-004/screenshot-02.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-004/screenshot-02.png): Admin Audit Log shows duplicate `PAYMENT_SUCCESS` rows with different transaction IDs for the same order.
- **Automated Test:** `test_dl_bug_004_duplicate_payment_transactions` confirms retries are rejected.

---

## 5. DL-BUG-005: Incorrect Product Ranking Heap

### Affected File
- [src/services/products.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/products.service.js)

### Lines of Code to Replace in `getTrendingProducts()` (Lines 136–152)
**Remove this buggy comparator:**
```javascript
// BUGGY CODE (Lines 139-142): Inverted subtraction turns Max-Heap into Min-Heap
const buggyComparator = (a, b) => {
  return b.computedScore - a.computedScore;
};
```

**Replace with the correct Max-Heap comparator (Lines 114–126):**
```javascript
// FIXED CODE:
const comparator = (a, b) => {
  const diff = a.computedScore - b.computedScore;
  if (Math.abs(diff) > 0.0001) {
    return diff; // positive diff means 'a' has higher score (Max-Heap)
  }
  // Deterministic tie-breaker for identical scores
  return b.id.localeCompare(a.id);
};

const maxHeap = new PriorityQueueHeap(comparator);
productsWithScore.forEach((item) => maxHeap.push(item));
```

### Visual Proof & Test
- **Screenshot:** [DL-BUG-005/screenshot-01.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-005/screenshot-01.png) shows Rank #1 occupied by the lowest-performing product instead of bestsellers.
- **Automated Test:** `test_dl_bug_005_product_ranking_heap` verifies descending score order.

---

## 6. DL-BUG-006: Broken Filtered Pagination and Dropped Items

### Affected File
- [src/services/products.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/products.service.js)

### Lines of Code to Replace in `getProductsFiltered()` (Lines 235–275)
**Remove this buggy slice-before-filter code:**
```javascript
// BUGGY CODE (Lines 240-244): Slices raw products BEFORE filtering
const offset = (pageNum - 1) * limitNum;
const preSliced = db.products.slice(offset, offset + limitNum * 2);

let filtered = preSliced.filter((p) => { ... });
// And computes totalPages on raw db.products.length!
totalPages: Math.ceil(db.products.length / limitNum)
```

**Replace with filter-first pipeline (Lines 174–234):**
```javascript
// FIXED CODE:
// 1. Filter ALL products first across the complete dataset
let filtered = db.products.filter((p) => {
  if (category && category !== 'all' && p.categorySlug !== category) return false;
  if (brand && p.brand.toLowerCase() !== brand.toLowerCase()) return false;
  if (minPrice !== undefined && minPrice !== '' && p.price < Number(minPrice)) return false;
  if (maxPrice !== undefined && maxPrice !== '' && p.price > Number(maxPrice)) return false;
  if (minRating !== undefined && minRating !== '' && p.rating < Number(minRating)) return false;
  if (inStockOnly === true || inStockOnly === 'true') {
    if (p.stock <= 0) return false;
  }
  if (isFlashSale === true || isFlashSale === 'true') {
    if (!p.isFlashSale) return false;
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    return p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
  }
  return true;
});

// 2. Sort filtered items...

// 3. Compute pagination strictly on the FILTERED items length
const totalItems = filtered.length;
const totalPages = Math.ceil(totalItems / limitNum) || 1;
const offset = (pageNum - 1) * limitNum;
const paginatedItems = filtered.slice(offset, offset + limitNum);

return {
  products: paginatedItems,
  pagination: {
    currentPage: pageNum,
    totalPages,
    totalItems,
    limit: limitNum,
    hasNextPage: pageNum < totalPages,
    hasPrevPage: pageNum > 1
  }
};
```

### Visual Proof & Test
- **Screenshots:**
  - [DL-BUG-006/screenshot-01.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-006/screenshot-01.png): Category Audio + Sony (2 items) erroneously calculates "Page 1 of 5".
  - [DL-BUG-006/screenshot-02.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-006/screenshot-02.png): Page 3 drops items prematurely ("No products match these filters").
- **Automated Test:** `test_dl_bug_006_combined_filters_and_pagination` passes in `2ms`.

---

## 7. DL-BUG-007: False Payment Success Confirmation Without Verification

### Affected File
- [src/services/payments.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/payments.service.js)

### Lines of Code to Replace in `verifyPayment()` (Lines 16–30)
**Remove this insecure code:**
```javascript
// BUGGY CODE (Lines 16-29): Falsely trusts redirect status parameter
if (redirectStatus === 'success' || (order && order.status !== 'CANCELLED')) {
  return {
    verified: true, // Falsely confirmed!
    paymentStatus: 'SUCCESS'
  };
}
```

**Replace with server-side database verification (Lines 31–52):**
```javascript
// FIXED CODE:
const payment = db.findPaymentByOrderId(order.id);
if (!payment) {
  return {
    verified: false,
    orderId: order.id,
    orderStatus: order.status,
    paymentStatus: 'NOT_FOUND'
  };
}

return {
  verified: payment.status === 'SUCCESS' && order.status !== 'PENDING_PAYMENT',
  orderId: order.id,
  orderNumber: order.orderNumber,
  orderStatus: order.status,
  paymentStatus: payment.status,
  amount: payment.amount,
  transactionId: payment.transactionId,
  updatedAt: payment.createdAt
};
```

### Visual Proof & Test
- **Screenshots:**
  - [DL-BUG-007/screenshot-01.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-007/screenshot-01.png): Gateway popup displays "Payment Completed Successfully!" even when backend returned failure.
  - [DL-BUG-007/screenshot-02.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-007/screenshot-02.png): Order history shows the true state: `PENDING_PAYMENT`.
- **Automated Test:** `test_dl_bug_007_false_payment_success_screen` confirms unpaid orders return `verified: false`.

---

## 8. DL-BUG-008: Depleted Warehouse Over-Allocation Deficit

### Affected File
- [src/services/warehouse.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/warehouse.service.js)

### Lines of Code to Replace in `allocateInventory()` (Lines 87–125)
**Remove this buggy greedy logic:**
```javascript
// BUGGY CODE (Lines 88-114): Checks raw stock ignoring reservedStock
const buggySorted = [...inventories].sort((a, b) => b.stock - a.stock);
for (const inv of buggySorted) {
  if (inv.stock <= 0) continue;
  const take = Math.min(remaining, inv.stock);
  inv.stock = Math.max(0, inv.stock - take); // Corrupts inventory without reservation!
  // ...
}
```

**Replace with priority-ordered net-available allocation (Lines 28–86):**
```javascript
// FIXED CODE:
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
```

### Visual Proof & Test
- **Screenshot:** [DL-BUG-008/screenshot-01.png](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-008/screenshot-01.png) shows `WH-MUM-01` over-allocated (Stock: 2, Reserved: 3) while `WH-DEL-02` (Stock: 1, Reserved: 0) was ignored.
- **Automated Test:** `test_dl_bug_008_warehouse_inventory_allocation` passes in `1ms`.

---

## Running the Automated Proofs

```bash
# Challenge Mode (reproduces all 8 bugs, showing 8 failing tests):
npm run test:challenge

# Reference Mode (activates all 8 reference fixes, 100% tests pass):
npm run test:reference

# Visual Evidence Generator (reproduces journeys and captures all 16 screenshots):
npm run capture:evidence
```
