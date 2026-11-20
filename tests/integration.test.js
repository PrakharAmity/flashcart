import assert from 'node:assert';
import { authService } from '../src/services/auth.service.js';
import { productsService } from '../src/services/products.service.js';
import { cartService } from '../src/services/cart.service.js';
import { ordersService } from '../src/services/orders.service.js';
import { sellersService } from '../src/services/sellers.service.js';
import { adminService } from '../src/services/admin.service.js';
import { db } from '../src/db/index.js';

async function runIntegrationTests() {
  console.log('Running FlashCart Core Application Integration Tests...');
  db.reset();

  // 1. Authentication Tests
  console.log('  Testing Auth: Customer Login...');
  const customerLogin = authService.login('customer@flashcart.demo', 'FlashCart@123');
  assert.strictEqual(customerLogin.user.role, 'CUSTOMER');
  assert.ok(customerLogin.token);

  console.log('  Testing Auth: Seller Login...');
  const sellerLogin = authService.login('seller@flashcart.demo', 'FlashCart@123');
  assert.strictEqual(sellerLogin.user.role, 'SELLER');

  console.log('  Testing Auth: Admin Login...');
  const adminLogin = authService.login('admin@flashcart.demo', 'FlashCart@123');
  assert.strictEqual(adminLogin.user.role, 'ADMIN');

  console.log('  Testing Auth: Invalid Credentials...');
  assert.throws(() => authService.login('customer@flashcart.demo', 'WrongPass!'), /Invalid email or password/);

  console.log('  Testing Auth: Registration...');
  const newReg = authService.register({
    email: 'newuser@example.com',
    password: 'Password@123',
    name: 'New Registered User',
    role: 'CUSTOMER'
  });
  assert.strictEqual(newReg.user.email, 'newuser@example.com');

  console.log('  Testing Auth: Prevent Admin via Public Registration...');
  assert.throws(
    () => authService.register({ email: 'fakeadmin@test.com', password: 'Pass', name: 'Fake', role: 'ADMIN' }),
    /cannot create ADMIN accounts/
  );

  console.log('  Testing Auth: Refresh Token Rotation...');
  const refreshed = authService.refresh(customerLogin.refreshToken);
  assert.ok(refreshed.token);
  assert.notStrictEqual(refreshed.refreshToken, customerLogin.refreshToken);

  console.log('  Testing Auth: Password Reset Flow...');
  const forgot = authService.forgotPassword('customer@flashcart.demo');
  assert.ok(forgot.devResetToken);
  const resetRes = authService.resetPassword(forgot.devResetToken, 'NewFlashCartPass@123');
  assert.ok(resetRes.success);
  // Revert password
  const customerUser = db.findUserByEmail('customer@flashcart.demo');
  customerUser.passwordHash = customerLogin.user ? customerUser.passwordHash : null;

  // 2. Product & Category Tests
  console.log('  Testing Products & Categories...');
  assert.strictEqual(db.categories.length, 8);
  assert.ok(db.products.length >= 50);

  const product = productsService.getProductById('prod-mob-01');
  assert.ok(product);
  assert.strictEqual(product.categorySlug, 'mobiles');

  // 3. Cart Operations
  console.log('  Testing Cart Operations...');
  const userId = 'user-customer-demo';
  cartService.clearCart(userId);
  let cart = cartService.addToCart(userId, 'prod-mob-01', 1);
  assert.strictEqual(cart.itemCount, 1);
  cart = cartService.updateQuantity(userId, 'prod-mob-01', 3);
  assert.strictEqual(cart.itemCount, 3);
  cart = cartService.removeFromCart(userId, 'prod-mob-01');
  assert.strictEqual(cart.itemCount, 0);

  // 4. Seller Operations
  console.log('  Testing Seller Operations...');
  const sellerMetrics = sellersService.getSellerDashboardMetrics('seller-1');
  assert.ok(sellerMetrics.grossRevenue > 0);
  assert.ok(sellerMetrics.totalProducts > 0);

  // 5. Admin Operations
  console.log('  Testing Admin Operations...');
  const adminMetrics = adminService.getPlatformMetrics();
  assert.ok(adminMetrics.totalProducts >= 50);
  assert.ok(adminMetrics.warehousesCount === 5);
  const warehouses = adminService.getAllWarehouses();
  assert.strictEqual(warehouses.length, 5);

  console.log('All Core Application Integration Tests Passed!\n');
}

runIntegrationTests().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
