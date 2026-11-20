# FlashCart — Development & Engineering Log
Application ID: `DL-APP-001`
Target Repository: `Alex MorganAmity/flashcart`

## Work Log Summary

### Milestone 1: Project Foundation & Architecture
- Initialized Node/Express project structure compliant with DEBUG//LAB Node-Express container standards.
- Configured network binding strictly to `0.0.0.0:3000` to support preview proxies under `/runtime/{runtime_id}/preview/`.
- Configured native `node --watch server.js` for instant live reload upon IDE file edits.
- Created environment configurations: `.env.example`, `.env.reference`, and `config.js`.

### Milestone 2: Authentication & Multi-Tenant Authorization
- Implemented `auth.service.js` with PBKDF2 cryptographic password hashing and timing-safe verification.
- Built JWT bearer token generation and HTTP-only cookie support with refresh token rotation.
- Configured 3 roles: `CUSTOMER`, `SELLER`, `ADMIN`.
- Restricted public registration from selecting `ADMIN` role.
- Seeded default demo credentials:
  - Customer: `customer@flashcart.demo` / `FlashCart@123`
  - Seller: `seller@flashcart.demo` / `FlashCart@123`
  - Admin: `admin@flashcart.demo` / `FlashCart@123`

### Milestone 3: Storefront & Production UI Engineering
- Created modern, responsive e-commerce storefront matching the visual identity from the user's mockup.
- Built header announcement strip, category selector, real-time search with Ctrl+K shortcut, and shopping cart counter.
- Developed Winter Collection 2026 Hero section with value propositions (Free Delivery above ₹999, Secure Payments, Easy Returns).
- Implemented Deals of the Day with a live ticking countdown timer (`08:21:36`).
- Built category carousels across 8 core product domains (Mobiles, Laptops, Audio, Wearables, Cameras, Gaming, Home & Living, Fashion).
- Added Product Details Modal with image gallery, specs, stock indicator, and review metrics.

### Milestone 4: Shopping Cart & Checkout Workflows
- Implemented interactive cart drawer with dynamic item quantities, deletions, and promotional coupons (`MEGAFEST2026`).
- Built checkout modal with delivery address selection, payment method options (UPI, Card, Net Banking), and price breakdown with 18% GST calculation.
- Integrated order placement and cancellation workflows.

### Milestone 5: Simulated Payment Gateway
- Developed full-lifecycle simulated payment gateway with realistic processing spinner, success/failure transitions, retry handling, and backend verification.

### Milestone 6: Seller & Admin Portals
- Built Seller Operations portal with store analytics, revenue trends, inventory stock editor, and product deletion.
- Built Admin Control Panel with platform GMV, user management, 5-hub warehouse monitor, and security audit logs.

### Milestone 7: DSA Algorithms & Intentional Bug Implementations
- Implemented PriorityQueue Binary Max-Heap for trending product ranking.
- Implemented Multi-Warehouse inventory allocation respecting regional priorities and reserved capacities.
- Injected exactly 8 intentional bugs (DL-BUG-001 through DL-BUG-008) in challenge mode with clean reference mode toggles.
- Created 8 detailed internal bug records in `bug-records/` and candidate-facing `challenge.json`.

### Milestone 8: Testing & Verification
- Implemented test runner in `tests/runner.js` producing strict JSON output format.
- Verified that in Challenge Mode (`REFERENCE_MODE=false`), all 8 intentional defects are caught and reported as failed.
- Verified that in Reference Mode (`REFERENCE_MODE=true`), all 8 tests pass 100% with exit code 0.
