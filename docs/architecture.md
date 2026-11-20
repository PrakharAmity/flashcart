# FlashCart — Architecture & System Design
Application ID: `DL-APP-001`
Domain: E-Commerce / Marketplace Flash-Sale Platform

## 1. System Overview
FlashCart is architected as a high-throughput, production-grade e-commerce application engineered to handle massive spikes during the Mega Shopping Festival. The architecture balances real-time responsiveness, modular service boundaries, deterministic algorithmic execution, and zero-downtime offline execution within DEBUG//LAB containers.

## 2. Component Architecture
```
+-----------------------------------------------------------------------------------+
|                              FLASHCART PLATFORM                                   |
+-----------------------------------------------------------------------------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
     [Client Frontend Layer]                      [API Gateway / Router]
     - Modern Responsive SPA UI                   - Express HTTP Server (0.0.0.0:3000)
     - Tailwind CSS + Lucide Icons                - Relative API / Static Proxy Support
     - Role Navigation (Customer/Seller/Admin)    - Cookie & JWT Bearer Authentication
                   |                                         |
                   +--------------------+--------------------+
                                        |
     +----------------------------------+----------------------------------+
     |                                  |                                  |
[Domain Services]             [DSA Engineering Core]          [Persistence Engine]
- AuthService                 - PriorityQueueHeap (DL-BUG-005)- ACID In-Memory Store
- ProductsService             - Deterministic Filter/Paging   - Transactional Mutex
- CartService                 - Multi-Warehouse Allocator     - Seed Database Fixtures
- CheckoutService (DL-BUG-001)  (DL-BUG-008)                  - Audit Log Journaling
- InventoryService(DL-BUG-003)                                - Snapshots & Reseeding
- PaymentsService (DL-BUG-004, 007)
- SellersService / AdminService
```

## 3. Network & Runtime Binding
- **Network Binding:** Every HTTP server binds to `0.0.0.0:3000`. Exclusively binding to `localhost` or `127.0.0.1` is strictly forbidden to prevent proxy connection refused errors in DEBUG//LAB.
- **Preview Proxy Support:** Supports deep subpaths under `/runtime/{runtime_id}/preview/` with relative static assets and API prefixes.
- **Live Watcher:** Automatic reloading via `node --watch server.js` reflects IDE code modifications immediately without manual terminal interventions.

## 4. State Management & Idempotency
- Cart states are tracked per user and synchronized on checkout.
- Order placement enforces idempotency keys (`x-idempotency-key`) and per-user critical locks to prevent duplicate order generation.
- Inventory reservation utilizes critical section mutexes to prevent overselling of limited-quantity promotional products.
