FlashCart
Description
FlashCart is a high-traffic production e-commerce marketplace application built with Node.js and Express 4. The server entry point in server.js serves static storefront client assets from public/ and exposes REST API endpoints for authentication, product discovery, catalog filtering, shopping cart operations, checkout processing, simulated payment gateways, seller management, and multi-warehouse administrative oversight. In-memory application state and database collections are managed in src/db/index.js, which seeds users, products, categories, coupons, warehouses, and inventory from src/db/seed-data.js on server startup. Core marketplace operations are modularized into domain services: src/services/auth.service.js manages PBKDF2 password hashing, session tokens, and role-based access control, src/services/products.service.js handles catalog querying, filtering, pagination, and Binary Max-Heap priority ranking for trending items, src/services/cart.service.js manages persistent cart items and promotional coupon calculations, src/services/inventory.service.js performs atomic stock reservation and replenish logic, src/services/checkout.service.js orchestrates order placement, tax calculations, and idempotency, src/services/payments.service.js handles simulated payment processing, retry lifecycles, and transaction verification, and src/services/warehouse.service.js allocates regional order fulfillment across multi-warehouse priority tiers.

Repository Structure
.
├── challenge.json          # Challenge definition and runtime configuration
├── package.json            # Dependencies and npm scripts
├── server.js               # Express server entry point
├── public/                 # Storefront frontend client
│   ├── app.js              # Client state, dynamic rendering, and API calls
│   ├── index.html          # Single-page e-commerce storefront markup
│   └── styles.css          # Visual styling, responsive layout, and theme tokens
├── src/
│   ├── config.js           # Environment configurations and mode toggles
│   ├── db/                 # Database and in-memory persistence layer
│   │   ├── index.js        # Data store models, helper lookups, and audit logs
│   │   └── seed-data.js    # Seed dataset (products, users, warehouses, coupons)
│   ├── middleware/         # Express middlewares
│   │   └── auth.middleware.js # JWT verification and role-based route guards
│   ├── routes/             # REST API endpoint definitions
│   │   ├── admin.routes.js
│   │   ├── auth.routes.js
│   │   ├── cart.routes.js
│   │   ├── categories.routes.js
│   │   ├── checkout.routes.js
│   │   ├── coupons.routes.js
│   │   ├── flash-sales.routes.js
│   │   ├── health.routes.js
│   │   ├── orders.routes.js
│   │   ├── payments.routes.js
│   │   ├── products.routes.js
│   │   ├── search.routes.js
│   │   └── seller.routes.js
│   ├── services/           # Domain business logic layer
│   │   ├── admin.service.js
│   │   ├── auth.service.js
│   │   ├── cart.service.js
│   │   ├── checkout.service.js
│   │   ├── inventory.service.js
│   │   ├── orders.service.js
│   │   ├── payments.service.js
│   │   ├── products.service.js
│   │   ├── sellers.service.js
│   │   └── warehouse.service.js
│   └── utils/
│       └── security.js     # Cryptographic hashing and token utilities
├── tests/                  # Integration and verification test suites
│   ├── integration.test.js
│   ├── runner.js           # Automated test harness producing JSON output
│   └── tests.js            # Challenge and reference test assertions
└── debuglab/
    └── visual-evidence/    # Playwright visual evidence generation suite
        ├── capture-evidence.js
        ├── evidence-manifest.json
        └── execution-report.md

Bugs and Bug Locations
Duplicate Checkout Requests
Bug location: "src/services/checkout.service.js", within placeOrder(userId, checkoutData, idempotencyKey).
How to observe it: Add items to cart, proceed to Checkout, and double-click the "Place Order & Pay" button or send two rapid POST /api/checkout/place-order requests with the same user session.
Failure: The service lacks an active in-flight concurrency lock and idempotency token verification, causing concurrent requests to proceed simultaneously, generate duplicate order records, double-charge the user, and double-decrement inventory.
Expected: The service must maintain an active session lock per userId and check an idempotency key cache, rejecting duplicate in-flight submissions with 409 Conflict or returning the original completed order.
Stale Product Search Responses
Bug location: "src/routes/search.routes.js" within GET /api/search and "public/app.js" within handleSearchInput(e).
How to observe it: Type "laptop" into the global search bar, then quickly clear and type "mobile", or issue rapid asynchronous queries where an earlier query has higher latency.
Failure: Search client event handlers do not verify response sequence counters against state.lastSearchRequestId, allowing the slower delayed response for "laptop" to arrive late and overwrite the dropdown results for "mobile".
Expected: Search responses must verify request sequence IDs and discard any response where data.requestId < state.lastSearchRequestId, or abort previous in-flight requests using AbortController so visible results match the active query.
Concurrent Inventory Overselling
Bug location: "src/services/inventory.service.js", within reserveStock(productId, quantity).
How to observe it: Set product stock to 1 (such as the Nikon Z8 / prod-cam-06) and execute simultaneous checkouts from two customer accounts or concurrent calls to reserveStock(productId, 1).
Failure: A non-atomic read-then-write pattern allows multiple concurrent callers to read product.stock = 1 before either caller decrements, allowing both reservations to succeed and driving physical stock into negative deficit (-1 units).
Expected: Stock availability checking and decrementing must be wrapped in an atomic Mutex critical section so concurrent reservation attempts execute sequentially, allowing only 1 reservation to succeed and failing subsequent attempts with out-of-stock.
Duplicate Payment Transactions
Bug location: "src/services/payments.service.js", within processPayment(orderId, paymentData).
How to observe it: Complete payment for an order on the payment gateway modal, then click "Retry Payment" after success or call POST /api/payments/process again for the same order.
Failure: processPayment() does not verify whether an order already has a successful transaction in db.payments, creating an additional PAYMENT_SUCCESS record and issuing a second transaction ID for the same order.
Expected: The payment service must query db.payments for existing records matching orderId with status === 'SUCCESS' and reject duplicate payment attempts with HTTP 400 Bad Request or return the existing settled payment.
Incorrect Product Ranking Heap
Bug location: "src/services/products.service.js", within getTrendingProducts(limit).
How to observe it: Inspect the "Trending Top Picks" section on the storefront homepage or call GET /api/products/trending.
Failure: The Priority Queue Binary Heap comparator subtracts b.computedScore - a.computedScore instead of a.computedScore - b.computedScore, inverting the heap into a Min-Heap and placing the lowest-selling, lowest-rated products at Rank #1 while bestsellers are pushed down.
Expected: The comparator must return a.computedScore - b.computedScore for Max-Heap priority extraction and use deterministic string comparison b.id.localeCompare(a.id) for tie-breaking.
Incorrect Combined Filters and Pagination
Bug location: "src/services/products.service.js", within getProductsFiltered(options).
How to observe it: Filter products in the Shop catalog by Category "Audio" and Brand "Sony" (2 matching items), observe total pages showing "Page 1 of 5", and click to Page 3.
Failure: The function slices the unfiltered dataset by pagination offset first (db.products.slice(offset, offset + limit * 2)) before filtering, and computes totalPages from raw db.products.length, causing valid filtered items to vanish across pages and rendering premature empty states.
Expected: The function must apply all filter criteria to the complete dataset first, compute totalPages based on filtered.length, and then slice the filtered array for the requested page (filtered.slice(offset, offset + limit)).
False Payment Success Screen
Bug location: "src/services/payments.service.js", within verifyPayment(orderId, redirectStatus).
How to observe it: Trigger a failed simulated payment or navigate to the payment verification endpoint for an unpaid order with query string status=success.
Failure: The verification logic blindly trusts the URL parameter redirectStatus === 'success' without checking database transaction records, returning verified: true and displaying an "Order Confirmed & Paid" screen for unpaid orders.
Expected: verifyPayment() must look up db.findPaymentByOrderId(orderId) and return verified: true only when a database payment record exists with status === 'SUCCESS' and order.status !== 'PENDING_PAYMENT'.
Incorrect Warehouse Inventory Allocation
Bug location: "src/services/warehouse.service.js", within allocateInventory(items, orderId).
How to observe it: Set primary warehouse WH-MUM-01 to stock: 3, reserved: 3 (0 net available) and secondary WH-DEL-02 to stock: 1, reserved: 0 (1 net available), then request order allocation for 1 unit.
Failure: The allocator sorts warehouses by raw stock descending instead of priority, and checks raw inv.stock without subtracting inv.reservedStock, deducting from depleted warehouses and causing negative available capacity.
Expected: Warehouses must be sorted by priority ascending (priority: 1 first), net available stock must be calculated as Math.max(0, inv.stock - inv.reservedStock), and allocations must deduct only available unreserved stock before overflowing to secondary hubs.
