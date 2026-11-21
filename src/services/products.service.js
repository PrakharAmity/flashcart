import { db } from '../db/index.js';
import { config } from '../config.js';

// Genuine Binary Max-Heap Implementation for Priority Queue Ranking
export class PriorityQueueHeap {
  constructor(comparator) {
    this.heap = [];
    this.comparator = comparator;
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  peek() {
    return this.heap[0] || null;
  }

  push(item) {
    this.heap.push(item);
    this._siftUp(this.heap.length - 1);
  }

  pop() {
    if (this.isEmpty()) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (!this.isEmpty()) {
      this.heap[0] = bottom;
      this._siftDown(0);
    }
    return top;
  }

  _siftUp(index) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.comparator(this.heap[current], this.heap[parent]) > 0) {
        [this.heap[current], this.heap[parent]] = [this.heap[parent], this.heap[current]];
        current = parent;
      } else {
        break;
      }
    }
  }

  _siftDown(index) {
    let current = index;
    const length = this.heap.length;
    while (true) {
      const left = 2 * current + 1;
      const right = 2 * current + 2;
      let largest = current;

      if (left < length && this.comparator(this.heap[left], this.heap[largest]) > 0) {
        largest = left;
      }
      if (right < length && this.comparator(this.heap[right], this.heap[largest]) > 0) {
        largest = right;
      }

      if (largest !== current) {
        [this.heap[current], this.heap[largest]] = [this.heap[largest], this.heap[current]];
        current = largest;
      } else {
        break;
      }
    }
  }
}

export function computeProductScore(product) {
  const sales = product.salesScore || 0;
  const rating = product.rating || 0;
  const reviews = product.reviewCount || 0;
  // Composite score: sales weight 0.4 + rating (0-5 * 20 = 100) + review weight 0.1
  return Number((sales * 0.4 + rating * 20 + reviews * 0.1).toFixed(2));
}

export const productsService = {
  getAllProducts() {
    return db.products;
  },

  getProductById(id) {
    return db.findProductById(id);
  },

  getProductBySlug(slug) {
    return db.findProductBySlug(slug);
  },

  getRelatedProducts(productId, limit = 4) {
    const target = db.findProductById(productId);
    if (!target) return [];
    return db.products
      .filter((p) => p.id !== target.id && p.categorySlug === target.categorySlug)
      .slice(0, limit);
  },

  // DL-BUG-005: Incorrect Product Ranking Heap
  getTrendingProducts(limit = 8) {
    const productsWithScore = db.products.map((p) => ({
      ...p,
      computedScore: computeProductScore(p)
    }));

    if (config.isReferenceMode) {
      const comparator = (a, b) => {
        const diff = a.computedScore - b.computedScore;
        if (Math.abs(diff) > 0.0001) {
          return diff;
        }
        return b.id.localeCompare(a.id);
      };

      const maxHeap = new PriorityQueueHeap(comparator);
      productsWithScore.forEach((item) => maxHeap.push(item));

      const ranked = [];
      while (!maxHeap.isEmpty() && ranked.length < limit) {
        ranked.push(maxHeap.pop());
      }
      return ranked;
    } else {
      const buggyComparator = (a, b) => {
        return b.computedScore - a.computedScore;
      };

      const maxHeap = new PriorityQueueHeap(buggyComparator);
      productsWithScore.forEach((item) => maxHeap.push(item));

      const ranked = [];
      while (!maxHeap.isEmpty() && ranked.length < limit) {
        ranked.push(maxHeap.pop());
      }
      return ranked;
    }
  },

  getProductsFiltered(options = {}) {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      minRating,
      inStockOnly,
      isFlashSale,
      sort = 'popularity',
      search,
      page = 1,
      limit = 12
    } = options;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);

    if (config.isReferenceMode) {
      let filtered = db.products.filter((p) => {
        if (category && category !== 'all' && p.categorySlug !== category) return false;
        if (brand && p.brand.toLowerCase() !== brand.toLowerCase()) return false;
        if (minPrice !== undefined && minPrice !== '' && p.price < Number(minPrice)) return false;
        if (maxPrice !== undefined && maxPrice !== '' && p.price > Number(maxPrice)) return false;
        if (minRating !== undefined && minRating !== '' && p.rating < Number(minRating)) return false;
        if (inStockOnly === true || inStockOnly === 'true') {
          if (p.stock <= 0) return false;
        }
        if (isFlashSale === true || isFlashSale === 'true') {
          if (!p.isFlashSale) return false;
        }
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          const matchTitle = p.title.toLowerCase().includes(q);
          const matchDesc = p.description.toLowerCase().includes(q);
          const matchBrand = p.brand.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchBrand) return false;
        }
        return true;
      });

      filtered.sort((a, b) => {
        if (sort === 'price-low') {
          return a.price !== b.price ? a.price - b.price : a.id.localeCompare(b.id);
        }
        if (sort === 'price-high') {
          return a.price !== b.price ? b.price - a.price : a.id.localeCompare(b.id);
        }
        if (sort === 'rating') {
          return a.rating !== b.rating ? b.rating - a.rating : a.id.localeCompare(b.id);
        }
        if (sort === 'newest') {
          return b.id.localeCompare(a.id);
        }
        const scoreA = computeProductScore(a);
        const scoreB = computeProductScore(b);
        return scoreB !== scoreA ? scoreB - scoreA : a.id.localeCompare(b.id);
      });

      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / limitNum) || 1;
      const offset = (pageNum - 1) * limitNum;
      const paginatedItems = filtered.slice(offset, offset + limitNum);

      return {
        products: paginatedItems,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      };
    } else {
      const offset = (pageNum - 1) * limitNum;
      const preSliced = db.products.slice(offset, offset + limitNum * 2);

      let filtered = preSliced.filter((p) => {
        if (category && category !== 'all' && p.categorySlug !== category) return false;
        if (brand && p.brand.toLowerCase() !== brand.toLowerCase()) return false;
        if (minPrice !== undefined && minPrice !== '' && p.price < Number(minPrice)) return false;
        if (maxPrice !== undefined && maxPrice !== '' && p.price > Number(maxPrice)) return false;
        if (minRating !== undefined && minRating !== '' && p.rating < Number(minRating)) return false;
        if (inStockOnly === true || inStockOnly === 'true') {
          if (p.stock <= 0) return false;
        }
        if (isFlashSale === true || isFlashSale === 'true') {
          if (!p.isFlashSale) return false;
        }
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          return p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
        }
        return true;
      });

      return {
        products: filtered.slice(0, limitNum),
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(db.products.length / limitNum),
          totalItems: filtered.length,
          limit: limitNum,
          hasNextPage: pageNum < Math.ceil(db.products.length / limitNum),
          hasPrevPage: pageNum > 1
        }
      };
    }
  }
};
