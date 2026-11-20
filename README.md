# FlashCart — Production E-Commerce Application

## 1. Your Mission: Investigate & Fix the Bugs

You are a Full-Stack Developer working on FlashCart, a high-traffic production e-commerce marketplace designed to handle high-volume flash-sale events, concurrent orders, multi-warehouse fulfillment, and simulated payment processing. The QA team has identified eight critical issues affecting everyday marketplace operations.

Your responsibility is to investigate the existing codebase, reproduce each issue, identify its root cause, and implement reliable fixes without disrupting existing functionality.

### BUG-01: Duplicate Checkout Requests
Problem: Clicking the "Place Order" button in rapid succession or double-clicking creates multiple separate orders for a single cart checkout instead of an idempotent single order.

How to identify it: Open the shopping cart with items, navigate to Checkout, and click the "Place Order" button multiple times rapidly. Observe that two or more distinct orders with different order IDs appear in the order history for the same checkout intent.

Your task: Ensure checkout requests are idempotent, debounced on the client, and validated on the backend so that only one order is created per checkout attempt.

### BUG-02: Stale Product Search Responses
Problem: Searching for products quickly causes slower in-flight responses from earlier queries to overwrite newer search results.

How to identify it: Open the search bar and type a query (e.g., "laptop"), then immediately clear it and type a different query (e.g., "phone"). Observe that results for "laptop" overwrite the results for "phone" once the slower request completes.

Your task: Ensure that asynchronous search responses are tracked by sequence or canceled so that only the latest query's results are displayed.

### BUG-03: Concurrent Inventory Overselling
Problem: When multiple customers simultaneously purchase the last remaining stock of a flash-sale item, the backend inventory check and stock decrement occur without atomic concurrency locks, allowing stock levels to drop below zero.

How to identify it: Send concurrent checkout requests for a product with only 1 unit remaining. Observe that both checkouts succeed, resulting in a negative inventory balance (e.g., -1 stock).

Your task: Use atomic reservation locks or transaction isolation during stock verification and decrement so stock can never be oversold or drop below zero.

### BUG-04: Duplicate Payment Transactions
Problem: When a customer's payment request encounters network delay and they retry the transaction, the payment gateway processes a second charge and records duplicate successful payments for an order that has already been paid.

How to identify it: Initiate a payment for an order, simulate a retry or submit a second payment request with the same order ID after the first succeeds. Notice that two payment records are created and both mark the order as charged twice.

Your task: Implement payment idempotency checks and verify that orders in a terminal "PAID" state reject duplicate payment attempts.

### BUG-05: Incorrect Product Ranking Heap
Problem: The binary heap algorithm used for ranking trending products and flash-sale items inverts priority comparison or truncates sales scores, resulting in lower-scoring products being ranked above top-tier items.

How to identify it: View the "Deals of the Day" or trending items section. Inspect the sales score and rating calculation. Notice that products with lower composite scores appear ranked higher than products with superior sales performance.

Your task: Correct the heap comparator and percolate logic to ensure high-priority products with the highest composite sales scores correctly occupy the top positions of the max-heap.

### BUG-06: Incorrect Combined Filters and Pagination
Problem: When applying multi-faceted filters (e.g., category "Laptops" + price range + brand) together with pagination, matching products disappear across pages or return 0 items because pagination offset slicing is applied before filtering the dataset.

How to identify it: Navigate to the Shop page, select Category "Laptops", set a price filter, and navigate between Page 1 and Page 2. Observe that matching products disappear or page 2 returns empty even though matching products exist in the catalog.

Your task: Ensure catalog filtering and sorting are evaluated completely across the full dataset before applying pagination slice limits.

### BUG-07: False Payment Success Screen
Problem: When a payment fails or is interrupted, navigating or redirecting to the payment confirmation page with `?status=success` in the query string causes the frontend to display a false "Order Confirmed & Paid" screen without verifying the actual payment state on the backend.

How to identify it: Place an order with payment state "FAILED" or "PENDING". Manually navigate to `/checkout/confirmation?orderId=FC-2026-10003&status=success`. Observe that the screen celebrates a successful payment even though the backend order remains unpaid.

Your task: Ensure the payment confirmation view verifies the actual order and payment transaction status with the backend API before displaying a success state.

### BUG-08: Incorrect Warehouse Inventory Allocation
Problem: When allocating order fulfillment across the 5 regional warehouses, the greedy allocation algorithm assigns inventory to a warehouse that has already exhausted its unreserved stock, causing warehouse inventory deficits.

How to identify it: Place orders requiring stock allocation across multiple fulfillment hubs. Check the warehouse allocation report. Notice that units are allocated to hubs with 0 unreserved stock rather than cascading to available secondary priority hubs.

Your task: Check both physical inventory and unreserved stock availability before assigning items to a warehouse, properly falling back to subsequent regional hubs according to priority.

## 2. Get Familiar With the Application

FlashCart is a production-grade e-commerce application that provides a unified platform for flash-sale shopping, order fulfillment, and multi-role operations.

Core Features:

Product Discovery: Browse products by category, apply dynamic filters, and view product details with high-resolution imagery.

Flash Sales: Discover time-limited promotional deals with live countdown timers.

Cart & Checkout: Manage item quantities, apply discount coupons, select delivery addresses, and calculate taxes.

Simulated Payments: Process simulated payments via UPI, Credit/Debit cards, and Net Banking with realistic states.

Inventory & Warehouses: Track stock across multiple fulfillment hubs with greedy warehouse allocation.

Seller & Admin Portals: Manage product listings, view revenue analytics, monitor stock levels, and review platform metrics.

Authentication & Security: Secure JWT-based authentication with role-based access control (Customer, Seller, Admin) and password reset flows.

Demo Accounts:

Customer: customer@flashcart.demo / FlashCart@123 (Storefront, Orders, Wishlist)

Seller: seller@flashcart.demo / FlashCart@123 (Seller Dashboard, Catalog Editor)

Admin: admin@flashcart.demo / FlashCart@123 (Admin KPIs, Warehouses, Audit Logs)

## 3. Expected Behaviour After Fixing the Bugs

Once all reported issues have been resolved, the application should behave as follows:

Checkout Idempotency: Multiple rapid checkout submissions create only a single order without duplicates.

Search Response Consistency: Only results matching the most recent search query are displayed, discarding stale out-of-order responses.

Atomic Inventory Reservation: Concurrent orders for limited flash-sale inventory never result in negative stock or overselling.

Payment Transaction Idempotency: Payment retries on already paid orders do not create duplicate transactions or double-charge the customer.

Product Ranking Heap Ordering: The Priority Queue Max-Heap orders products strictly by composite sales score, placing top-scoring products at the top.

Combined Filtering and Pagination: Applying multiple filters alongside pagination preserves all matching items across pages without dropping items prematurely.

Verified Payment Confirmation: The payment confirmation screen verifies transaction state against the backend API and only confirms orders that are genuinely paid.

Warehouse Inventory Allocation: Order fulfillment allocates stock only from warehouses with available unreserved inventory, falling back to secondary hubs when top-priority hubs are exhausted.

All existing e-commerce functionality must continue working as expected.
