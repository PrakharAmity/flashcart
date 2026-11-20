import { db } from '../db/index.js';

export const sellersService = {
  getSellerByUserId(userId) {
    return db.sellers.find((s) => s.userId === userId) || db.sellers[0];
  },

  getSellerDashboardMetrics(sellerId) {
    const products = db.products.filter((p) => p.sellerId === sellerId);
    const seller = db.sellers.find((s) => s.id === sellerId);

    // Collect orders with seller's products
    let totalSales = 0;
    let totalOrders = 0;
    const sellerProductIds = new Set(products.map((p) => p.id));

    db.orders.forEach((ord) => {
      const match = ord.items.filter((item) => sellerProductIds.has(item.productId));
      if (match.length > 0) {
        totalOrders++;
        totalSales += match.reduce((sum, item) => sum + item.price * item.quantity, 0);
      }
    });

    const lowStockAlerts = products.filter((p) => p.stock < 15);

    return {
      storeName: seller ? seller.storeName : 'Apex Retail India',
      rating: seller ? seller.rating : 4.9,
      totalProducts: products.length,
      totalOrders: totalOrders || 28,
      grossRevenue: totalSales || 4850000,
      lowStockAlertsCount: lowStockAlerts.length,
      lowStockProducts: lowStockAlerts.map((p) => ({ id: p.id, title: p.title, stock: p.stock })),
      recentSalesTrend: [
        { day: 'Mon', revenue: 142000, orders: 12 },
        { day: 'Tue', revenue: 189000, orders: 15 },
        { day: 'Wed', revenue: 215000, orders: 18 },
        { day: 'Thu', revenue: 310000, orders: 24 },
        { day: 'Fri', revenue: 420000, orders: 32 },
        { day: 'Sat', revenue: 650000, orders: 48 },
        { day: 'Sun', revenue: 780000, orders: 56 }
      ]
    };
  },

  getSellerProducts(sellerId) {
    return db.products.filter((p) => p.sellerId === sellerId);
  },

  createProduct(sellerId, productData) {
    const newProduct = {
      id: `prod-custom-${Date.now()}`,
      slug: productData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: productData.title,
      description: productData.description || '',
      categorySlug: productData.categorySlug || 'mobiles',
      brand: productData.brand || 'FlashCart Verified',
      price: Number(productData.price) || 999,
      originalPrice: Number(productData.originalPrice) || Number(productData.price) || 999,
      discountPercentage: Math.max(0, Math.round(((productData.originalPrice - productData.price) / productData.originalPrice) * 100)) || 0,
      rating: 5.0,
      reviewCount: 0,
      salesScore: 100,
      sellerId,
      stock: Number(productData.stock) || 10,
      isFlashSale: !!productData.isFlashSale,
      images: productData.images && productData.images.length > 0 ? productData.images : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'],
      specs: productData.specs || {},
      createdAt: new Date().toISOString()
    };

    db.products.unshift(newProduct);

    // Also add to primary warehouse
    db.warehouseInventory.push({
      id: `wi-wh-1-${newProduct.id}`,
      warehouseId: 'wh-1',
      productId: newProduct.id,
      stock: newProduct.stock,
      reservedStock: 0
    });

    return newProduct;
  },

  updateProduct(sellerId, productId, updates) {
    const product = db.products.find((p) => p.id === productId && p.sellerId === sellerId);
    if (!product) {
      throw new Error('Product not found or not owned by seller');
    }

    if (updates.price !== undefined) product.price = Number(updates.price);
    if (updates.stock !== undefined) product.stock = Number(updates.stock);
    if (updates.title !== undefined) product.title = updates.title;
    if (updates.description !== undefined) product.description = updates.description;

    return product;
  },

  deleteProduct(sellerId, productId) {
    const idx = db.products.findIndex((p) => p.id === productId && p.sellerId === sellerId);
    if (idx === -1) {
      throw new Error('Product not found or unauthorized');
    }
    const deleted = db.products.splice(idx, 1)[0];
    return { success: true, deletedId: deleted.id };
  }
};
