# FlashCart — Business Workflows & Domain Operations
Application ID: `DL-APP-001`

## 1. Mega Shopping Festival Checkout Flow
```
Customer browses catalog -> Adds items to cart -> Opens checkout modal ->
Applies Coupon (e.g. MEGAFEST2026) -> Selects Shipping Address ->
Selects Payment Method (UPI/Card/NetBanking) ->
Submits Checkout (Idempotent session lock) ->
Inventory Reservation (Atomic stock deduction) ->
Warehouse Allocation (Priority sorted net available stock) ->
Simulated Gateway Settlement -> Backend Verification -> Order Processing.
```

## 2. Multi-Warehouse Inventory Fulfillment
FlashCart operates 5 regional warehouses:
1. `WH-MUM-01` (Priority 1, West Hub - 25,000 units capacity)
2. `WH-DEL-02` (Priority 2, North Mega Fulfillment - 30,000 units capacity)
3. `WH-BLR-03` (Priority 3, South Tech Logistics - 22,000 units capacity)
4. `WH-CCU-04` (Priority 4, East Gateway Depot - 15,000 units capacity)
5. `WH-MAA-05` (Priority 5, Coastal Express Center - 18,000 units capacity)

When an order is confirmed:
- Allocation calculates Net Available Stock = `stock - reservedStock`.
- Orders prioritize higher priority warehouses to minimize shipping cost and delivery latency.
- Reservations are recorded in `inventoryReservations` with status `RESERVED`.

## 3. Post-Purchase Fulfillment, Cancellation & Refunds
- Customers can monitor tracking milestones (`PROCESSING` -> `SHIPPED` -> `DELIVERED`).
- Cancellation is permitted while status is `PENDING_PAYMENT` or `PROCESSING`. Cancelled orders replenish inventory stock.
- Customers can initiate 7-day policy returns for `DELIVERED` orders, which triggers an automated refund record and updates order status to `REFUNDED`.

## 4. Multi-Tenant Role Isolation
- **CUSTOMER**: Restricted to personal orders, cart, wishlist, and profile.
- **SELLER**: Restricted to managing items in their own store catalog. Sellers cannot view or edit products from competing merchants.
- **ADMIN**: Access to platform GMV, warehouse monitors, user accounts, and security audit logs.
