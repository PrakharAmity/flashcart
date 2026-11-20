# FlashCart — Database Design & Schema Specification
Application ID: `DL-APP-001`

## 1. Schema Entities

### Users
- `id`: String (UUID or prefixed identifier)
- `email`: String (Unique, normalized lowercase)
- `passwordHash`: String (PBKDF2 SHA-256 with salt)
- `name`: String
- `role`: Enum (`CUSTOMER`, `SELLER`, `ADMIN`)
- `phone`: String
- `status`: Enum (`ACTIVE`, `SUSPENDED`)
- `createdAt`: ISO Timestamp

### Sellers
- `id`: String
- `userId`: Foreign key -> `Users.id`
- `storeName`: String
- `rating`: Decimal (0.0 - 5.0)
- `totalSales`: Integer
- `verified`: Boolean

### Warehouses & Inventory
- `Warehouse`: `id`, `code` (e.g. `WH-MUM-01`), `name`, `location`, `capacity`, `priority` (1-5)
- `WarehouseInventory`: `id`, `warehouseId`, `productId`, `stock`, `reservedStock`
- `InventoryReservation`: `id`, `orderId`, `productId`, `warehouseId`, `quantity`, `status` (`RESERVED`, `COMMITTED`, `RELEASED`)

### Products & Categories
- `Category`: `id`, `slug`, `name`, `icon`, `description`, `productCount`
- `Product`: `id`, `slug`, `title`, `description`, `categorySlug`, `brand`, `price`, `originalPrice`, `discountPercentage`, `rating`, `reviewCount`, `salesScore`, `sellerId`, `stock`, `isFlashSale`, `flashSaleDiscount`, `badge`, `images`, `specs`

### Orders, Payments & Fulfillment
- `Order`: `id`, `orderNumber`, `userId`, `items` (with warehouse allocations), `subtotal`, `tax`, `deliveryFee`, `discount`, `couponCode`, `total`, `status` (`PENDING_PAYMENT`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `REFUNDED`), `shippingAddress`, `paymentMethod`, `idempotencyKey`
- `Payment`: `id`, `orderId`, `userId`, `amount`, `method`, `status` (`PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`), `transactionId`
- `PaymentAttempt`: `id`, `paymentId`, `orderId`, `attemptNumber`, `status`, `idempotencyKey`, `gatewayRef`
- `Refund`: `id`, `orderId`, `userId`, `amount`, `reason`, `status` (`REQUESTED`, `PROCESSED`, `REJECTED`)
- `AuditLog`: `id`, `action`, `userId`, `role`, `details`, `timestamp`

## 2. Seed Data Guarantee
- Minimum 50 products across 8 categories
- 10 registered sellers
- 5 regional fulfillment warehouses
- 20 customers
- 20 historical sample orders with payment & shipment records
- Active flash sales and promotional coupons (`MEGAFEST2026`, `WELCOME50`, `TECHDEAL10`, `FLASH200`)
