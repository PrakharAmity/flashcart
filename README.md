# FlashCart — Production E-Commerce Application

Welcome to **FlashCart**! FlashCart is a high-traffic, production-grade online shopping platform built with Node.js and Express. It handles real-world e-commerce workflows like instant product search, flash sales, shopping carts, simulated UPI and card payments, regional multi-warehouse inventory fulfillment, and admin monitoring dashboards.

---

## Quick Navigation Links

- 📖 **Complete Technical Solutions & Line-by-Line Code Fixes:** [solutions.md](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/solutions.md)
- 📊 **Visual Evidence Execution Summary Report:** [execution-report.md](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/execution-report.md)
- 🗂️ **Visual Evidence Manifest (JSON):** [evidence-manifest.json](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/evidence-manifest.json)

---

## Detailed Breakdown of the 8 Production Bugs & Visual Screenshots

Below is a detailed guide to each of the 8 production bugs. Every bug explanation includes what happens, why it harms the business and customers, how to fix it, and direct links to our annotated screenshots with **red visual demonstration cards** and **high-visibility glowing badges**.

---

### Bug 1: Duplicate Checkout Requests (The Double-Click Order Glitch)

#### 1. What happens in the app?
When a customer is checking out on a slow connection or double-clicks the "Place Order & Pay" button, their browser sends two checkout requests to `/api/checkout/place-order` at almost the exact same millisecond. 
Instead of recognizing that both requests belong to the same purchase, the server processes both requests simultaneously. It creates two completely separate order numbers (`FC-2026-60229` and `FC-2026-77952`), charges the customer's payment method twice, and deducts the inventory stock twice!

#### 2. Why is this a serious problem?
- **Customer Frustration:** Customers see duplicate bank transactions and two orders on their account for identical items.
- **Stock Depletion:** Flash-sale stock gets incorrectly deducted twice, causing items to prematurely show as out of stock.

#### 3. How to fix it:
In [src/services/checkout.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/checkout.service.js), we add two protections:
1. **Per-User Concurrency Lock:** When a user starts checkout, add their `userId` to an active lock set. If a second request comes in before the first completes, reject it with HTTP `409 Conflict`.
2. **Idempotency Key Cache:** Save completed order records in a map keyed by the client's `idempotencyKey`. If a duplicate request arrives later, return the already-created order without charging again.

#### 4. Visual Evidence & Screenshots:
- [View DL-BUG-001 Annotated Screenshot](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-001/screenshot-01.png)
  - **Floating Card (Top Right):** Displays `BUG 1 VISUAL DEMONSTRATION` with the description *"Rapidly clicking or double-clicking 'Place Order' bypasses idempotency guards and creates multiple distinct orders and charges for a single checkout attempt."*
  - **Highlighted UI Elements:** The customer's order history shows two red dashed boxes around the two identical orders:
    - `⚠️ Duplicate Order #1 (FC-2026-77952) - Placed via double-click`
    - `⚠️ Duplicate Order #2 (FC-2026-60229) - Identical items charged twice!`

---

### Bug 2: Stale Product Search Responses Overwrite Active Query

#### 1. What happens in the app?
When searching for products, the user types a query (e.g., "laptop"), changes their mind, clears it, and quickly types another query (e.g., "mobile"). 
Because network queries have different response speeds (or the backend query for "laptop" takes longer), the faster "mobile" search returns first and displays phones. A few seconds later, the delayed "laptop" search finishes and overwrites the dropdown list with laptops, even though the search input still clearly says "mobile"!

#### 2. Why is this a serious problem?
- **Misleading UI:** Customers see laptops while typing "mobile", confusing them and breaking product discovery.
- **Lost Sales:** Customers think the store has no phones or that the search bar is broken.

#### 3. How to fix it:
In [public/app.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/public/app.js) and [src/routes/search.routes.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/routes/search.routes.js):
1. **Sequence Numbering:** Add a `requestId` number to every search request that counts up (`1, 2, 3...`).
2. **Discard Stale Results:** If a response arrives with a `requestId` smaller than `state.lastSearchRequestId`, throw it away immediately.
3. **Request Cancellation:** Use JavaScript's `AbortController` to cancel in-flight network searches when new characters are typed.

#### 4. Visual Evidence & Screenshots:
- [View DL-BUG-002 Step 1 Screenshot](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-002/screenshot-01.png):
  - Shows the initial state: query is "mobile", and the fast search response correctly renders mobile phones. Tagged with blue `🔍 Active Query Input: "mobile"` and green `✅ Mobile search response displayed`.
- [View DL-BUG-002 Step 2 Screenshot](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-002/screenshot-02.png):
  - Shows the bug occurring: the delayed "laptop" search finishes and overwrites the dropdown with MacBooks, while the input bar still reads "mobile". Tagged with amber `⚠️ Active Search Input Remains: "mobile"` and red `🚨 BUG: Stale "laptop" results overwrote the active search dropdown!`.

---

### Bug 3: Concurrent Inventory Overselling During Flash Sale

#### 1. What happens in the app?
During a limited flash sale, a popular item (like the Nikon Z8 camera) has only 1 unit remaining in stock. Two independent customers (Customer A and Customer B) open checkout and click "Place Order" at the exact same millisecond.
Because FlashCart checked inventory with a non-atomic read-then-write pattern, both checkout processes read `stock = 1`, both approve the purchase, both collect simulated payments, and remaining stock drops to `-1`!

#### 2. Why is this a serious problem?
- **Overselling Deficit:** The company confirmed and charged two customers for an item it only has one of in the warehouse.
- **Operational Chaos:** Warehouse staff must cancel an order, issue apologies, process refunds, and deal with dissatisfied customers.

#### 3. How to fix it:
In [src/services/inventory.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/inventory.service.js), wrap inventory reservation in an atomic `Mutex` lock. Each checkout request must wait in line so that reading stock and deducting stock happen together atomically. When Customer A takes the 1 unit, remaining stock is 0; when Customer B's turn arrives, the check immediately fails with *"Out of stock"*.

#### 4. Visual Evidence & Screenshots:
- [Step 1: Customer A Checkout](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-01.png): Customer A proceeds to checkout with the last camera unit (Stock: 1).
- [Step 2: Customer B Simultaneous Checkout](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-02.png): Customer B concurrently checking out the exact same camera.
- [Step 3: Customer A Payment Succeeded](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-03.png): Customer A's payment succeeds and claims the 1 available unit.
- [Step 4: Customer B Oversell Error](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-04.png): Customer B's order ALSO succeeds erroneously with the badge `🚨 Oversold! Order confirmed despite zero stock remaining!`.
- [Step 5: Catalog Deficit State](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-003/screenshot-05.png): The Nikon Z8 product modal shows `🚨 Critical Inventory Deficit: Backordered (-1 units)!`.

---

### Bug 4: Duplicate Payment Charges on Payment Retry

#### 1. What happens in the app?
When an order is paid, the payment gateway popup displays "Payment Completed Successfully!". However, the "Retry Payment" button remains clickable and active. 
If the customer clicks "Retry Payment", FlashCart does not check if the order was already paid. It contacts the gateway, charges the customer a second time, and logs two separate `PAYMENT_SUCCESS` transactions with two different transaction IDs for the same single order!

#### 2. Why is this a serious problem?
- **Double Charging:** Direct financial loss and customer complaints due to duplicate charges on credit cards or UPI.
- **Audit Accounting Errors:** The accounting database shows conflicting revenue records for a single order.

#### 3. How to fix it:
In [src/services/payments.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/payments.service.js), check `db.payments` before creating any charge. If an existing transaction for `order.id` already has `status === 'SUCCESS'`, reject the payment with HTTP `400 Bad Request` stating *"Order has already been paid successfully"*.

#### 4. Visual Evidence & Screenshots:
- [View DL-BUG-004 Step 1 (Gateway Screen)](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-004/screenshot-01.png):
  - Highlights the vulnerability on the gateway modal where the "Retry Payment" button is erroneously enabled despite the payment having settled. Tagged with blue `💳 Transaction 1 Issued` and red `⚠️ Vulnerability: "Retry Payment" button remains active after success!`.
- [View DL-BUG-004 Step 2 (Admin Audit Log)](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-004/screenshot-02.png):
  - Shows the Admin Audit Log with two distinct `[PAYMENT_SUCCESS]` rows for the same order ID:
    - Red badge: `🚨 Transaction 2: Duplicate SUCCESS charged to order (TXN-DUP-602456-8261)`
    - Blue badge: `💳 Transaction 1: Original valid SUCCESS transaction (TXN-DUP-601600-3661)`

---

### Bug 5: Inverted Trending Products Ranking

#### 1. What happens in the app?
FlashCart uses a Priority Queue (Binary Max-Heap) data structure to rank products on the homepage under "Trending Top Picks" based on sales volume, ratings, and customer reviews. 
Due to an inverted comparison function, the algorithm behaved like a Min-Heap instead of a Max-Heap! The products with the lowest sales and lowest engagement were pushed to the top of the homepage, while top sellers like high-end laptops and smartphones were hidden at the bottom.

#### 2. Why is this a serious problem?
- **Reduced Revenue:** The store fails to promote its most popular and highest-converting products on the most visible area of the site.
- **Poor User Experience:** Shoppers see unpopular or niche items on the storefront front page.

#### 3. How to fix it:
In [src/services/products.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/products.service.js), fix the comparator function in `getTrendingProducts()`:
- Use `a.computedScore - b.computedScore` (positive difference promotes `a` above `b` in the Max-Heap).
- Add deterministic tie-breaking `b.id.localeCompare(a.id)` when scores are equal.

#### 4. Visual Evidence & Screenshots:
- [View DL-BUG-005 Screenshot](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-005/screenshot-01.png):
  - Shows the Trending Top Picks grid with the lowest-ranked item displayed at Rank #1. Tagged with `🚨 Inverted Rank #1: Lowest-ranked product placed at top!` and `⚠️ Inverted Rank #2: Low-sales item promoted over bestsellers`.

---

### Bug 6: Products Disappearing When Using Filters and Pages

#### 1. What happens in the app?
In the Shop catalog, customers can filter products by Category, Brand, Price Range, and Rating, and navigate through pages using pagination buttons.
If you select Category = "Audio" and Brand = "Sony" (which matches 2 products in our catalog), the pagination counter at the bottom of the page displays "Page 1 of 5" instead of "Page 1 of 1". Clicking to Page 3 causes the matching products to disappear completely, displaying *"No products match these filters"*.

#### 2. Why is this a serious problem?
- **Broken Catalog Navigation:** Slicing before filtering cuts off valid items that exist in the catalog.
- **Misleading Pagination:** The page count is computed from the entire store catalog (22 items ÷ 5 per page = 5 pages) rather than the filtered subset.

#### 3. How to fix it:
In [src/services/products.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/products.service.js):
1. **Filter Complete Dataset First:** Apply category, brand, and price filters across the complete product array.
2. **Compute Filtered Page Totals:** Calculate `totalItems = filtered.length` and `totalPages = Math.ceil(filtered.length / limit)`.
3. **Slice Only the Filtered Array:** Take the page slice (`filtered.slice(offset, offset + limit)`) strictly after filtering is complete.

#### 4. Visual Evidence & Screenshots:
- [View DL-BUG-006 Page 1 Screenshot](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-006/screenshot-01.png):
  - Shows Category "Audio" and Brand "Sony" applied. Page 1 displays 2 products, but pagination says `Page 1 of 5`. Tagged with blue `🔍 Active Filters: Audio + Sony (2 total matches)` and red `⚠️ Erroneous Pagination: "Page 1 of 5" instead of "Page 1 of 1"!`.
- [View DL-BUG-006 Page 3 Screenshot](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-006/screenshot-02.png):
  - Shows Page 3 displaying an empty box with `🚨 Premature Empty State: "No products match these filters"`.

---

### Bug 7: False Payment Success Screen

#### 1. What happens in the app?
When returning from an external payment gateway redirect, if someone visits the callback URL with `status=success` in the web query string, the frontend immediately displays "Payment Completed Successfully!". 
However, if the backend payment actually failed (or was never paid), the order in the database is still in `PENDING_PAYMENT` state. The UI falsely congratulates the user, while the order will never ship!

#### 2. Why is this a serious problem?
- **False Customer Confidence:** Customers think their payment succeeded and their items are on the way, but the order is never fulfilled.
- **Security Vulnerability:** A malicious client could manipulate query parameters to trigger success screens without paying.

#### 3. How to fix it:
In [src/services/payments.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/payments.service.js), the verification endpoint `/api/payments/verify/:orderId` must look up the true database payment record for that order. It must only return `verified: true` if `payment.status === 'SUCCESS' && order.status !== 'PENDING_PAYMENT'`, ignoring any unverified URL redirect parameters.

#### 4. Visual Evidence & Screenshots:
- [View DL-BUG-007 Step 1 (False Confirmation)](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-007/screenshot-01.png):
  - Shows the simulated gateway popup displaying `Payment Completed Successfully!` even though the backend returned failure. Tagged with red `🚨 False Success Heading: Backend payment actually FAILED!`.
- [View DL-BUG-007 Step 2 (Order History)](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-007/screenshot-02.png):
  - Shows the customer's actual order history. The order status is still `PENDING_PAYMENT` (Unpaid), exposing the mismatch.

---

### Bug 8: Assigning Orders to Depleted Regional Warehouses

#### 1. What happens in the app?
FlashCart has 5 regional fulfillment hubs across India:
- `WH-MUM-01` (Priority 1)
- `WH-DEL-02` (Priority 2)
- `WH-BLR-03` (Priority 3)
- `WH-CCU-04` (Priority 4)
- `WH-MAA-05` (Priority 5)

When a customer orders an item, the allocator algorithm is supposed to fulfill the order from the highest-priority warehouse with available stock. 
However, the allocator checked raw physical stock instead of unreserved available stock! For example, `WH-MUM-01` had 3 stock and 3 reserved units (meaning `0` available units). The allocator assigned an order to `WH-MUM-01` anyway, reducing stock to 2 with 3 reserved (a negative deficit of `-1`!), while ignoring `WH-DEL-02` which had 1 unreserved unit available.

#### 2. Why is this a serious problem?
- **Warehouse Bottlenecks:** Orders get assigned to warehouses that cannot fulfill them because all physical stock is already promised to other orders.
- **Stock Depletion Deficit:** Warehouses run into negative inventory capacity.

#### 3. How to fix it:
In [src/services/warehouse.service.js](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/src/services/warehouse.service.js):
1. **Sort by Priority:** Sort warehouses ascending by priority (`priority: 1` first).
2. **Compute Net Available Stock:** Calculate `availableInWh = Math.max(0, inv.stock - inv.reservedStock)`.
3. **Sequential Allocation:** Only allocate up to `availableInWh`. When a warehouse has 0 available units, smoothly overflow to the next priority warehouse (`WH-DEL-02`).

#### 4. Visual Evidence & Screenshots:
- [View DL-BUG-008 Screenshot](file:///c:/Users/prakh/Desktop/DEBUG_LAB_NODEEXPRESS_APPLICATIONS/flashcart/debuglab/visual-evidence/DL-BUG-008/screenshot-01.png):
  - Shows the Admin Warehouse status dashboard. Tagged with red `🚨 WH-MUM-01: Stock 2 < Reserved 3 (Deficit: -1)` and yellow `⚠️ WH-DEL-02: Had 1 unreserved unit available`.

---

## How to Run & Verify FlashCart

### 1. Installation
```bash
npm install
```

### 2. Running the Development Server
```bash
# Run with automatic code watching and live reload
npm run dev

# Or run regular start
npm start
```
Open your browser at: `http://localhost:3000`

### 3. Demo Credentials
- **Customer Account:** `customer@flashcart.demo` / `FlashCart@123`
- **Seller Account:** `seller@flashcart.demo` / `FlashCart@123`
- **Admin Account:** `admin@flashcart.demo` / `FlashCart@123`

---

## Automated Testing & Proof

FlashCart includes an automated test suite verifying all 8 bugs:

```bash
# Challenge Mode: Runs against the buggy code — all 8 tests fail as expected
npm run test:challenge

# Reference Mode: Runs against the fixed code — all 8 tests pass 100%
npm run test:reference
```

To regenerate all 16 annotated screenshots at any time:
```bash
npm run capture:evidence
```
The script will run headless browser scenarios, apply the high-contrast callouts and demonstration cards, and validate that every screenshot meets strict dimension and image format standards.
