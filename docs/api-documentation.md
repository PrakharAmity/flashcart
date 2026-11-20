# FlashCart — REST API Documentation
Application ID: `DL-APP-001`

All endpoints are mounted on `/api`.

## 1. Authentication
- `POST /api/auth/register`: Create user account (`name`, `email`, `password`, `role`).
- `POST /api/auth/login`: Authenticate and obtain JWT cookie and bearer token.
- `POST /api/auth/refresh`: Rotate refresh token and obtain new session token.
- `POST /api/auth/logout`: Revoke active refresh session and clear cookie.
- `POST /api/auth/forgot-password`: Generate simulation password reset token.
- `POST /api/auth/reset-password`: Set new password with verified reset token.
- `GET  /api/auth/me`: Get current authenticated user profile and role.

## 2. Product Discovery & DSA Ranking
- `GET  /api/products`: Filter and paginate catalog (`category`, `brand`, `minPrice`, `maxPrice`, `minRating`, `inStockOnly`, `isFlashSale`, `sort`, `page`, `limit`).
- `GET  /api/products/trending`: Ranked trending products using Binary Max-Heap Priority Queue.
- `GET  /api/products/related/:id`: Get related products within same category.
- `GET  /api/products/:id`: Get detailed product specifications and stock.
- `GET  /api/search?q=...&requestId=...`: Live product search with sequence tracking.

## 3. Cart & Wishlist
- `GET    /api/cart`: Retrieve user shopping cart with totals and tax calculations.
- `POST   /api/cart/add`: Add product with specified quantity to cart.
- `PUT    /api/cart/update`: Adjust quantity of an item in cart.
- `DELETE /api/cart/remove/:productId`: Remove item from cart.
- `DELETE /api/cart/clear`: Empty cart.

## 4. Checkout & Payments
- `POST /api/checkout/place-order`: Initiate order placement with idempotency check (`x-idempotency-key`).
- `POST /api/payments/process`: Simulate payment settlement with bank gateway (`orderId`, `method`, `simulatedOutcome`).
- `GET  /api/payments/verify/:orderId`: Server-side payment verification checking settlement records.
- `GET  /api/payments/order/:orderId`: Lookup payment transaction details.

## 5. Orders & Post-Purchase
- `GET  /api/orders`: List authenticated user orders.
- `GET  /api/orders/:id`: Detailed order breakdown with warehouse allocations.
- `POST /api/orders/:id/cancel`: Cancel eligible pending/processing orders.
- `POST /api/orders/:id/refund`: Initiate 7-day return and refund workflow.

## 6. Seller Operations
- `GET    /api/seller/dashboard`: KPI metrics, revenue, and low-stock alerts.
- `GET    /api/seller/products`: Catalog items owned by seller.
- `POST   /api/seller/products`: Add new item to catalog and warehouse.
- `PUT    /api/seller/products/:id`: Update price or stock.
- `DELETE /api/seller/products/:id`: Delete product.

## 7. Platform Admin
- `GET /api/admin/metrics`: Platform-wide GMV, active users, orders, and warehouses count.
- `GET /api/admin/users`: User directory with status and roles.
- `GET /api/admin/warehouses`: Capacity and allocation monitor for all 5 hubs.
- `GET /api/admin/audit-logs`: System security journal.

## 8. Coupons, Flash Sales & Health
- `GET  /api/coupons`: List promotional vouchers.
- `POST /api/coupons/validate`: Check eligibility and calculate savings.
- `GET  /api/flash-sales`: Active festival campaigns and discounted products.
- `GET  /api/health`: Diagnostic health check reporting uptime and dataset statistics.
