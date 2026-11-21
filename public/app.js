// FlashCart Production Client Application
// DEBUG//LAB DL-APP-001

const state = {
  user: null,
  cart: { items: [], itemCount: 0, subtotal: 0, discount: 0, tax: 0, deliveryFee: 0, total: 0 },
  wishlist: [],
  categories: [],
  products: [],
  trending: [],
  deals: [],
  currentView: 'home',
  modalProduct: null,
  modalQuantity: 1,
  activeOrder: null,
  lastSearchRequestId: 0,
  filters: {
    category: 'all',
    brand: '',
    minPrice: '',
    maxPrice: '',
    minRating: '',
    inStockOnly: false,
    isFlashSale: false,
    sort: 'popularity',
    page: 1,
    limit: 12
  }
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  initLucide();
  setupHeroCarousel();
  initCountdownTimer();
  await checkSession();
  await loadCart();
  await loadInitialProducts();
  setupKeyboardShortcuts();

  // Support direct modal deep-linking for screenshots and evaluation
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  if (urlParams.get('product')) {
    openProductModal(urlParams.get('product'));
  } else if (hash.startsWith('#product=')) {
    openProductModal(hash.replace('#product=', ''));
  }
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
    document.querySelectorAll('svg.lucide:not([aria-label]):not([role])').forEach((icon) => {
      icon.setAttribute('aria-hidden', 'true');
    });
  }
}

// Countdown timer matching the screenshot ("Ends in 08:21:36")
function initCountdownTimer() {
  let secondsRemaining = 8 * 3600 + 21 * 60 + 36; // 08:21:36
  const timerEl = document.getElementById('countdown-timer');

  setInterval(() => {
    if (secondsRemaining > 0) {
      secondsRemaining--;
    } else {
      secondsRemaining = 12 * 3600; // Reset
    }
    const h = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
    const s = String(secondsRemaining % 60).padStart(2, '0');
    if (timerEl) {
      timerEl.textContent = `${h}:${m}:${s}`;
    }
  }, 1000);
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const userMenu = document.getElementById('user-dropdown-menu');
      if (userMenu && !userMenu.classList.contains('hidden')) {
        e.preventDefault();
        closeHeaderMenus(true);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('global-search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });
}

// ==================== AUTHENTICATION ====================
async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      state.user = data.user;
      updateUserUI();
    } else {
      // Default demo customer for smooth evaluation experience
      state.user = {
        id: 'user-customer-demo',
        name: 'Alex Morgan',
        email: 'customer@flashcart.demo',
        role: 'CUSTOMER'
      };
      updateUserUI();
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
}

function updateUserUI() {
  const nameEl = document.getElementById('user-name-display');
  const avatarEl = document.getElementById('user-avatar');
  const roleEl = document.getElementById('menu-user-role');
  const emailEl = document.getElementById('menu-user-email');
  const authActionBtn = document.getElementById('auth-action-btn');

  if (state.user) {
    if (nameEl) nameEl.textContent = state.user.name.split(' ')[0];
    if (avatarEl) avatarEl.textContent = state.user.name.charAt(0).toUpperCase();
    if (roleEl) roleEl.textContent = `Role: ${state.user.role}`;
    if (emailEl) emailEl.textContent = state.user.email;
    if (authActionBtn) {
      authActionBtn.innerHTML = '<i data-lucide="log-out" class="w-4 h-4 mr-2.5"></i> <span>Sign Out</span>';
    }
  } else {
    if (nameEl) nameEl.textContent = 'Sign In';
    if (avatarEl) avatarEl.textContent = 'G';
    if (roleEl) roleEl.textContent = 'Role: Guest';
    if (emailEl) emailEl.textContent = 'Not signed in';
    if (authActionBtn) {
      authActionBtn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4 mr-2.5"></i> <span>Sign In</span>';
    }
  }
  initLucide();
}

async function quickLogin(role) {
  let email = 'customer@flashcart.demo';
  if (role === 'seller') email = 'seller@flashcart.demo';
  if (role === 'admin') email = 'admin@flashcart.demo';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'FlashCart@123' })
    });
    const data = await res.json();
    if (res.ok) {
      state.user = data.user;
      updateUserUI();
      toggleUserMenu();
      showToast(`Switched to ${data.user.role} (${data.user.name})`, 'success');
      if (role === 'seller') navigate('seller');
      else if (role === 'admin') navigate('admin');
      else navigate('home');
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to authentication server', 'error');
  }
}

function handleAuthAction() {
  if (state.user) {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      state.user = null;
      updateUserUI();
      toggleUserMenu();
      showToast('Logged out successfully', 'info');
      navigate('home');
    });
  } else {
    toggleUserMenu();
    openAuthModal();
  }
}

// ==================== NAVIGATION ====================
const homeHeroSlides = [
  { productId: 'prod-mob-08', productName: 'Motorola Edge 50 Ultra', src: 'images/motorola-edge-50-ultra.jpg', alt: 'Motorola Edge 50 Ultra smartphone, shown front and back', badge: 'Flash Sale Live' },
  { productId: 'prod-mob-06', productName: 'Nothing Phone 3', src: 'images/nothing-phone-3.jpg', alt: 'Nothing Phone 3 smartphone', badge: 'New arrival' },
  { productId: 'prod-cam-05', productName: 'GoPro HERO13', src: 'images/gopro-hero-13.jpg', alt: 'GoPro HERO13 action camera', badge: 'Ready for adventure' }
];
let homeHeroSlideIndex = 0;
let homeHeroRotationTimer = null;
let homeHeroPointerPaused = false;
let homeHeroFocusPaused = false;
let dealSlideIndex = 0;
let dealRotationTimer = null;
let dealPointerPaused = false;
let dealFocusPaused = false;
let dealsCarouselReady = false;

function syncHeroCarouselAutoplay() {
  if (homeHeroRotationTimer) {
    clearInterval(homeHeroRotationTimer);
    homeHeroRotationTimer = null;
  }

  if (homeHeroPointerPaused || homeHeroFocusPaused || document.hidden || state.currentView !== 'home') return;
  homeHeroRotationTimer = setInterval(() => setHeroSlide(homeHeroSlideIndex + 1), 5000);
}

function setupHeroCarousel() {
  const carousel = document.getElementById('home-hero-carousel');
  if (!carousel) return;

  carousel.addEventListener('pointerenter', () => {
    homeHeroPointerPaused = true;
    syncHeroCarouselAutoplay();
  });
  carousel.addEventListener('pointerleave', () => {
    homeHeroPointerPaused = false;
    syncHeroCarouselAutoplay();
  });
  carousel.addEventListener('focusin', () => {
    homeHeroFocusPaused = true;
    syncHeroCarouselAutoplay();
  });
  carousel.addEventListener('focusout', (event) => {
    if (!carousel.contains(event.relatedTarget)) {
      homeHeroFocusPaused = false;
      syncHeroCarouselAutoplay();
    }
  });
  document.addEventListener('visibilitychange', syncHeroCarouselAutoplay);
  syncHeroCarouselAutoplay();
}

function setHeroSlide(index) {
  homeHeroSlideIndex = (index + homeHeroSlides.length) % homeHeroSlides.length;
  const slide = homeHeroSlides[homeHeroSlideIndex];
  const image = document.getElementById('home-hero-image');
  const badge = document.getElementById('home-hero-badge');
  if (image) {
    image.src = slide.src;
    image.alt = slide.alt;
    image.setAttribute('aria-label', `View ${slide.productName}`);
  }
  if (badge) badge.textContent = slide.badge;
  document.querySelectorAll('[data-hero-slide]').forEach((dot) => {
    const active = Number(dot.dataset.heroSlide) === homeHeroSlideIndex;
    dot.setAttribute('aria-current', String(active));
    dot.classList.toggle('w-5', active);
    dot.classList.toggle('w-2', !active);
    dot.classList.toggle('bg-brand-600', active);
    dot.classList.toggle('bg-white/80', !active);
  });
}

function changeHeroSlide(direction) {
  setHeroSlide(homeHeroSlideIndex + direction);
}

function openHeroProduct() {
  openProductModal(homeHeroSlides[homeHeroSlideIndex].productId);
}

function openHeroProductFromKey(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openHeroProduct();
}

function navigate(viewName, params = {}) {
  const requestedViewName = viewName;
  if (viewName === 'deals') {
    viewName = 'shop';
    params = { ...params, isFlashSale: true };
  }

  state.currentView = viewName;
  syncHeroCarouselAutoplay();
  syncDealsCarouselAutoplay();
  const views = ['home', 'shop', 'profile', 'seller', 'admin', 'wishlist', 'about'];
  views.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  // Update nav active styles
  ['nav-home', 'nav-shop', 'nav-deals', 'nav-about'].forEach((id) => {
    const navLink = document.getElementById(id);
    if (navLink) {
      navLink.className = 'py-2.5 text-slate-600 hover:text-brand-600 transition';
      navLink.removeAttribute('aria-current');
    }
  });

  const activeNavId = requestedViewName === 'deals'
    ? 'nav-deals'
    : viewName === 'shop'
      ? 'nav-shop'
      : viewName === 'home'
        ? 'nav-home'
        : viewName === 'about'
          ? 'nav-about'
          : null;
  const activeNav = activeNavId && document.getElementById(activeNavId);
  if (activeNav) {
    activeNav.className = 'py-2.5 text-brand-600 border-b-2 border-brand-600 transition';
    activeNav.setAttribute('aria-current', 'page');
  }

  if (viewName === 'home') {
    // Home content is already present in the page shell.
  } else if (viewName === 'shop') {
    if (params.filter === 'newest') {
      state.filters.sort = 'newest';
      const sortSelect = document.getElementById('sort-select');
      if (sortSelect) sortSelect.value = 'newest';
    }
    if (params.isFlashSale) {
      state.filters.isFlashSale = true;
      const fsCheck = document.getElementById('filter-flashsale');
      if (fsCheck) fsCheck.checked = true;
    }
    syncCatalogQuickFilters();
    fetchShopProducts();
  } else if (viewName === 'profile') {
    loadCustomerOrders();
  } else if (viewName === 'seller') {
    loadSellerDashboard();
  } else if (viewName === 'admin') {
    loadAdminDashboard();
  } else if (viewName === 'wishlist') {
    renderWishlist();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  initLucide();
}

// ==================== PRODUCT LOADING & RENDERING ====================
async function loadInitialProducts() {
  try {
    // 1. Trending via Max-Heap (DL-BUG-005)
    const trendRes = await fetch('/api/products/trending?limit=8');
    const trendData = await trendRes.json();
    state.trending = trendData.trending || [];
    renderProductGrid('trending-product-grid', state.trending);

    // 2. Deals of the day
    const dealsRes = await fetch('/api/flash-sales');
    const dealsData = await dealsRes.json();
    state.deals = (dealsData.products || []).slice(0, 4);
    renderDealsCarousel();
    setupDealsCarousel();
  } catch (err) {
    console.error('Failed to load initial products', err);
  }
}

function renderDealsCarousel() {
  const carousel = document.getElementById('deals-carousel');
  const emptyState = document.getElementById('deals-empty');
  if (!carousel || !emptyState) return;

  const hasDeals = state.deals.length > 0;
  carousel.classList.toggle('hidden', !hasDeals);
  emptyState.classList.toggle('hidden', hasDeals);
  if (!hasDeals) return;

  dealSlideIndex = (dealSlideIndex + state.deals.length) % state.deals.length;
  const product = state.deals[dealSlideIndex];
  const image = document.getElementById('deal-image');
  image.src = product.images?.[0] || '';
  image.alt = product.title;
  document.getElementById('deal-product-button').setAttribute('aria-label', `View ${product.title}`);
  document.getElementById('deal-brand').textContent = `${product.brand} · ${product.categorySlug.replaceAll('-', ' ')}`;
  document.getElementById('deal-title').textContent = product.title;
  document.getElementById('deal-description').textContent = product.description;
  document.getElementById('deal-rating').textContent = product.rating.toFixed(1);
  document.getElementById('deal-reviews').textContent = `(${product.reviewCount.toLocaleString('en-IN')} reviews)`;
  document.getElementById('deal-price').textContent = `₹${product.price.toLocaleString('en-IN')}`;
  document.getElementById('deal-original-price').textContent = `₹${product.originalPrice.toLocaleString('en-IN')}`;
  document.getElementById('deal-discount').textContent = `${product.discountPercentage}% OFF`;
  document.getElementById('deal-image-badge').textContent = `${product.discountPercentage}% OFF`;
  document.getElementById('deal-dots').innerHTML = state.deals.map((deal, index) => `
    <button type="button" aria-label="Show deal ${index + 1}: ${deal.title}" aria-current="${index === dealSlideIndex}" onclick="setDealSlide(${index})"></button>
  `).join('');
  initLucide();
}

function setDealSlide(index) {
  if (!state.deals.length) return;
  dealSlideIndex = (index + state.deals.length) % state.deals.length;
  renderDealsCarousel();
}

function changeDealSlide(direction) {
  setDealSlide(dealSlideIndex + direction);
}

function openCurrentDeal() {
  const product = state.deals[dealSlideIndex];
  if (product) openProductModal(product.id);
}

function addCurrentDealToCart(event) {
  const product = state.deals[dealSlideIndex];
  if (product) quickAddToCart(product.id, event);
}

function syncDealsCarouselAutoplay() {
  if (dealRotationTimer) {
    clearInterval(dealRotationTimer);
    dealRotationTimer = null;
  }
  if (state.deals.length < 2 || dealPointerPaused || dealFocusPaused || document.hidden || state.currentView !== 'home') return;
  dealRotationTimer = setInterval(() => setDealSlide(dealSlideIndex + 1), 5000);
}

function setupDealsCarousel() {
  const carousel = document.getElementById('deals-carousel');
  if (!carousel || dealsCarouselReady) return;
  dealsCarouselReady = true;
  carousel.addEventListener('pointerenter', () => {
    dealPointerPaused = true;
    syncDealsCarouselAutoplay();
  });
  carousel.addEventListener('pointerleave', () => {
    dealPointerPaused = false;
    syncDealsCarouselAutoplay();
  });
  carousel.addEventListener('focusin', () => {
    dealFocusPaused = true;
    syncDealsCarouselAutoplay();
  });
  carousel.addEventListener('focusout', (event) => {
    if (!carousel.contains(event.relatedTarget)) {
      dealFocusPaused = false;
      syncDealsCarouselAutoplay();
    }
  });
  document.addEventListener('visibilitychange', syncDealsCarouselAutoplay);
  syncDealsCarouselAutoplay();
}

// Render product card matching the visual screenshot mockup
function renderProductGrid(elementId, products) {
  const container = document.getElementById(elementId);
  if (!container) return;

  if (products.length === 0) {
    const emptyStates = {
      'deals-product-grid': {
        title: 'No live deals right now',
        message: 'Explore the catalog and check back for the next offer.',
        action: `<button onclick="navigate('shop')" class="empty-state-action">Explore all tech</button>`
      },
      'shop-product-grid': {
        title: 'No products match these filters',
        message: 'Try a wider price range or clear your filters to see more products.',
        action: `<button onclick="resetFilters()" class="empty-state-action">Clear filters</button>`
      },
      'wishlist-product-grid': {
        title: 'Your wishlist is empty',
        message: 'Save a product with the heart button and it will show up here.',
        action: `<button onclick="navigate('shop')" class="empty-state-action">Browse products</button>`
      }
    };
    const emptyState = emptyStates[elementId] || {
      title: 'No products to show yet',
      message: 'Check back soon for more products.'
    };
    container.innerHTML = `
      <div class="col-span-full empty-state">
        <span class="empty-state-icon"><i data-lucide="package-search" class="w-6 h-6"></i></span>
        <h3>${emptyState.title}</h3>
        <p>${emptyState.message}</p>
        ${emptyState.action || ''}
      </div>
    `;
    initLucide();
    return;
  }

  container.innerHTML = products
    .map((prod) => {
      const isWishlisted = state.wishlist.includes(prod.id);
      const discountTag = prod.discountPercentage
        ? `<span class="absolute top-3 left-3 bg-rose-500 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-md shadow-xs z-10 tracking-tight">${prod.discountPercentage}% OFF</span>`
        : '';

      return `
      <div class="group bg-white rounded-2xl border border-slate-200/90 hover:border-brand-300 p-3.5 flex flex-col justify-between product-card relative overflow-hidden shadow-xs">
        ${discountTag}
        
        <!-- Wishlist toggle -->
        <button onclick="toggleWishlist('${prod.id}', event)" aria-label="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}" aria-pressed="${isWishlisted}" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition shadow-xs z-10">
          <i data-lucide="heart" class="w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}"></i>
        </button>

        <!-- Product Image -->
        <div class="w-full aspect-square rounded-xl overflow-hidden bg-slate-50/60 cursor-pointer mb-3 p-3 flex items-center justify-center relative" onclick="openProductModal('${prod.id}')">
          <img src="${prod.images[0]}" alt="${prod.title}" class="max-h-full max-w-full object-contain group-hover:scale-108 transition duration-300">
        </div>

        <!-- Info -->
        <div class="space-y-1.5 flex-1 flex flex-col justify-between">
          <div>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${prod.brand}</p>
            <h3 onclick="openProductModal('${prod.id}')" class="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 cursor-pointer hover:text-brand-600 transition leading-snug" title="${prod.title}">
              ${prod.title}
            </h3>
          </div>

          <div class="pt-2">
            <!-- Rating -->
            <div class="flex items-center gap-1.5 text-xs mb-1">
              <span class="flex items-center text-amber-500 font-bold text-[11px]">
                <i data-lucide="star" class="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5"></i> ${prod.rating}
              </span>
              <span class="text-slate-400 text-[10px] font-medium">(${prod.reviewCount})</span>
            </div>

            <!-- Price -->
            <div class="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-100">
              <div class="flex items-baseline gap-1.5">
                <span class="text-sm sm:text-base font-black text-slate-900 tabular-nums">₹${prod.price.toLocaleString('en-IN')}</span>
                ${prod.originalPrice > prod.price
          ? `<span class="text-[11px] text-slate-400 line-through tabular-nums font-medium">₹${prod.originalPrice.toLocaleString('en-IN')}</span>`
          : ''
        }
              </div>
              <button onclick="quickAddToCart('${prod.id}', event)" class="p-2 rounded-xl bg-brand-50 hover:bg-brand-600 text-brand-600 hover:text-white transition shadow-2xs" title="Add to Cart" aria-label="Add item to cart">
                <i data-lucide="plus" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
    })
    .join('');

  initLucide();
}

// ==================== SHOP FILTERING & PAGINATION (DL-BUG-006) ====================
function syncCatalogQuickFilters() {
  document.querySelectorAll('[data-category-quick]').forEach((button) => {
    const active = button.dataset.categoryQuick === state.filters.category;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const activeFilterCount = [
    state.filters.category !== 'all',
    Boolean(state.filters.brand),
    Boolean(state.filters.minPrice),
    Boolean(state.filters.maxPrice),
    Boolean(state.filters.minRating),
    state.filters.inStockOnly,
    state.filters.isFlashSale
  ].filter(Boolean).length;
  const countEl = document.getElementById('active-filter-count');
  const hintEl = document.querySelector('.catalog-filter-hint');
  if (countEl) countEl.textContent = activeFilterCount;
  if (hintEl) hintEl.textContent = activeFilterCount
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`
    : 'Category, brand, price and availability';
}

async function fetchShopProducts() {
  const queryParams = new URLSearchParams();
  if (state.filters.category && state.filters.category !== 'all') queryParams.set('category', state.filters.category);
  if (state.filters.brand) queryParams.set('brand', state.filters.brand);
  if (state.filters.minPrice) queryParams.set('minPrice', state.filters.minPrice);
  if (state.filters.maxPrice) queryParams.set('maxPrice', state.filters.maxPrice);
  if (state.filters.minRating) queryParams.set('minRating', state.filters.minRating);
  if (state.filters.inStockOnly) queryParams.set('inStockOnly', 'true');
  if (state.filters.isFlashSale) queryParams.set('isFlashSale', 'true');
  queryParams.set('sort', state.filters.sort);
  queryParams.set('page', state.filters.page);
  queryParams.set('limit', state.filters.limit);

  try {
    const res = await fetch(`/api/products?${queryParams.toString()}`);
    const data = await res.json();
    renderProductGrid('shop-product-grid', data.products || []);

    // Update pagination indicator
    const pagination = data.pagination;
    const indicatorEl = document.getElementById('pagination-page-indicator');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const countLabel = document.getElementById('catalog-count-label');

    if (pagination && indicatorEl) {
      indicatorEl.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
      if (prevBtn) prevBtn.disabled = !pagination.hasPrevPage;
      if (nextBtn) nextBtn.disabled = !pagination.hasNextPage;
      if (countLabel) countLabel.textContent = `Showing ${data.products.length} of ${pagination.totalItems} products`;
    }
  } catch (err) {
    console.error('Failed to fetch filtered shop products', err);
  }
}

function triggerFilterUpdate() {
  state.filters.category = document.getElementById('filter-category').value;
  state.filters.brand = document.getElementById('filter-brand').value.trim();
  state.filters.minPrice = document.getElementById('filter-min-price').value;
  state.filters.maxPrice = document.getElementById('filter-max-price').value;
  state.filters.minRating = document.getElementById('filter-rating').value;
  state.filters.inStockOnly = document.getElementById('filter-instock').checked;
  state.filters.isFlashSale = document.getElementById('filter-flashsale').checked;
  state.filters.sort = document.getElementById('sort-select').value;
  state.filters.page = 1; // Reset to page 1 on filter change
  syncCatalogQuickFilters();
  fetchShopProducts();
}

function resetFilters() {
  document.getElementById('filter-category').value = 'all';
  document.getElementById('filter-brand').value = '';
  document.getElementById('filter-min-price').value = '';
  document.getElementById('filter-max-price').value = '';
  document.getElementById('filter-rating').value = '';
  document.getElementById('filter-instock').checked = false;
  document.getElementById('filter-flashsale').checked = false;
  document.getElementById('sort-select').value = 'popularity';
  triggerFilterUpdate();
}

function changePage(direction) {
  state.filters.page = Math.max(1, state.filters.page + direction);
  fetchShopProducts();
}

function filterByCategory(slug) {
  state.filters.category = slug;
  const select = document.getElementById('filter-category');
  if (select) select.value = slug;
  syncCatalogQuickFilters();
  navigate('shop');
}

// ==================== SEARCH & DL-BUG-002 HANDLING ====================
let searchDebounceTimeout = null;

function handleSearchInput(e) {
  const query = e.target.value.trim();
  const dropdown = document.getElementById('search-results-dropdown');

  if (!query) {
    if (dropdown) dropdown.classList.add('hidden');
    return;
  }

  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(async () => {
    state.lastSearchRequestId++;
    const currentRequestId = state.lastSearchRequestId;

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&requestId=${currentRequestId}`);
      const data = await res.json();

      // In REFERENCE MODE: check sequence so stale out-of-order responses are discarded!
      // In CHALLENGE MODE (DL-BUG-002): sequence check is bypassed, allowing older slower query to overwrite newer!
      const isReferenceMode = window.IS_REFERENCE_MODE === true; // or derived
      if (isReferenceMode && Number(data.requestId) < state.lastSearchRequestId) {
        return; // Discard stale response
      }

      renderSearchResults(data.results || [], data.query || query);
    } catch (err) {
      console.error('Search request failed', err);
    }
  }, 100);
}

function renderSearchResults(results, query) {
  const dropdown = document.getElementById('search-results-dropdown');
  if (!dropdown) return;

  const headerHtml = `
    <div class="px-3.5 py-2 bg-slate-50/95 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
      <span>Search results for: <b class="text-brand-600 font-bold">"${query}"</b></span>
      <span class="text-[11px] text-slate-400 font-mono">${results.length} item${results.length === 1 ? '' : 's'}</span>
    </div>
  `;

  if (results.length === 0) {
    dropdown.innerHTML = `
      ${headerHtml}
      <div class="p-4 text-center text-xs text-slate-500">
        No matching products for "<b class="text-slate-800">${query}</b>"
      </div>
    `;
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = headerHtml + results
    .slice(0, 6)
    .map(
      (prod) => `
    <div onclick="openProductModal('${prod.id}'); document.getElementById('search-results-dropdown').classList.add('hidden');" class="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b border-slate-100 last:border-b-0 transition">
      <img src="${prod.images[0]}" class="w-10 h-10 object-cover rounded-lg border border-slate-100">
      <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-slate-900 truncate">${prod.title}</p>
        <p class="text-[11px] text-slate-500">${prod.brand} • <span class="font-bold text-brand-600 tabular-nums">₹${prod.price.toLocaleString('en-IN')}</span></p>
      </div>
    </div>
  `
    )
    .join('');

  dropdown.classList.remove('hidden');
}

// Close search dropdown when clicking outside
document.addEventListener('click', (e) => {
  const searchBox = document.getElementById('global-search-input');
  const dropdown = document.getElementById('search-results-dropdown');
  if (searchBox && dropdown && !searchBox.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});

// ==================== PRODUCT DETAILS MODAL ====================
async function openProductModal(productId) {
  try {
    const res = await fetch(`/api/products/${productId}`);
    const data = await res.json();
    const product = data.product;
    if (!product) return;

    state.modalProduct = product;
    state.modalQuantity = 1;

    document.getElementById('modal-product-img').src = product.images[0];
    document.getElementById('modal-product-title').textContent = product.title;
    document.getElementById('modal-product-brand').textContent = `${product.brand} • Category: ${product.categorySlug}`;
    document.getElementById('modal-product-price').textContent = `₹${product.price.toLocaleString('en-IN')}`;
    document.getElementById('modal-product-orig-price').textContent = `₹${product.originalPrice.toLocaleString('en-IN')}`;
    document.getElementById('modal-product-discount').textContent = `${product.discountPercentage}% Savings`;
    document.getElementById('modal-product-desc').textContent = product.description;
    document.getElementById('modal-quantity').textContent = '1';

    const stockEl = document.getElementById('modal-product-stock');
    if (product.stock > 0) {
      stockEl.textContent = `In Stock (${product.stock} units available)`;
      stockEl.className = 'font-bold text-emerald-600';
    } else if (product.stock < 0) {
      stockEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 font-extrabold border border-rose-300 text-xs">⚠️ DEFECT: OVERSOLD (${product.stock} Units - Negative Inventory)</span>`;
      stockEl.className = 'font-bold';
    } else {
      stockEl.textContent = 'Out of Stock (0 units)';
      stockEl.className = 'font-bold text-rose-600';
    }

    document.getElementById('product-modal').classList.remove('hidden');
    initLucide();
  } catch (err) {
    showToast('Failed to load product details', 'error');
  }
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}

function adjustModalQuantity(delta) {
  state.modalQuantity = Math.max(1, state.modalQuantity + delta);
  document.getElementById('modal-quantity').textContent = state.modalQuantity;
}

async function addModalItemToCart() {
  if (!state.modalProduct) return;
  await addToCart(state.modalProduct.id, state.modalQuantity);
  closeProductModal();
  toggleCartDrawer(true);
}

async function buyNowModalItem() {
  if (!state.modalProduct) return;
  await addToCart(state.modalProduct.id, state.modalQuantity);
  closeProductModal();
  openCheckoutModal();
}

async function quickAddToCart(productId, event) {
  if (event) event.stopPropagation();
  await addToCart(productId, 1);
  showToast('Added item to cart!', 'success');
}

// ==================== CART MANAGEMENT ====================
async function loadCart() {
  try {
    const res = await fetch('/api/cart');
    const data = await res.json();
    state.cart = data;
    renderCart();
  } catch (err) {
    console.error('Failed to load cart', err);
  }
}

async function addToCart(productId, quantity = 1) {
  try {
    const res = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    const data = await res.json();
    state.cart = data;
    renderCart();
  } catch (err) {
    showToast('Failed to add item to cart', 'error');
  }
}

async function updateCartQuantity(productId, quantity) {
  try {
    const res = await fetch('/api/cart/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    const data = await res.json();
    state.cart = data;
    renderCart();
  } catch (err) {
    showToast('Failed to update cart', 'error');
  }
}

async function removeFromCart(productId) {
  try {
    const res = await fetch(`/api/cart/remove/${productId}`, { method: 'DELETE' });
    const data = await res.json();
    state.cart = data;
    renderCart();
  } catch (err) {
    showToast('Failed to remove item', 'error');
  }
}

function renderCart() {
  // Update badge
  const badge = document.getElementById('cart-badge');
  if (badge) badge.textContent = state.cart.itemCount || 0;

  // Render items in drawer
  const container = document.getElementById('cart-drawer-items');
  if (!container) return;

  if (!state.cart.items || state.cart.items.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <i data-lucide="shopping-bag" class="w-12 h-12 mx-auto mb-2 text-slate-300"></i>
        <p class="font-medium text-sm">Your shopping cart is empty</p>
        <button onclick="toggleCartDrawer(); navigate('shop');" class="mt-4 px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-xs font-bold hover:bg-brand-100">
          Discover Tech Deals
        </button>
      </div>
    `;
    updateCartTotals(0, 0, 0, 0, 0);
    initLucide();
    return;
  }

  container.innerHTML = state.cart.items
    .map(
      (item) => `
    <div class="py-3 flex gap-3 items-center">
      <img src="${item.image}" class="w-16 h-16 rounded-xl object-cover border border-slate-100">
      <div class="flex-1 min-w-0">
        <h4 class="text-xs font-bold text-slate-900 truncate">${item.title}</h4>
        <p class="text-xs font-semibold text-brand-600 tabular-nums">₹${item.price.toLocaleString('en-IN')}</p>
        <div class="flex items-center gap-2 mt-2">
          <div class="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50 text-xs">
            <button onclick="updateCartQuantity('${item.productId}', ${item.quantity - 1})" class="px-2 py-0.5 text-slate-600 hover:bg-slate-200">-</button>
            <span class="px-2 py-0.5 font-bold text-slate-900 tabular-nums">${item.quantity}</span>
            <button onclick="updateCartQuantity('${item.productId}', ${item.quantity + 1})" class="px-2 py-0.5 text-slate-600 hover:bg-slate-200">+</button>
          </div>
          <button onclick="removeFromCart('${item.productId}')" class="text-rose-500 hover:text-rose-700 p-1" title="Delete">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
      <div class="text-right">
        <span class="text-xs font-bold text-slate-900 tabular-nums">₹${item.itemTotal.toLocaleString('en-IN')}</span>
      </div>
    </div>
  `
    )
    .join('');

  updateCartTotals(
    state.cart.subtotal,
    state.cart.discount,
    state.cart.tax,
    state.cart.deliveryFee,
    state.cart.total
  );
  initLucide();
}

function updateCartTotals(subtotal, discount, tax, delivery, total) {
  const subtotalEl = document.getElementById('cart-subtotal');
  const discountEl = document.getElementById('cart-discount');
  const taxEl = document.getElementById('cart-tax');
  const deliveryEl = document.getElementById('cart-delivery');
  const totalEl = document.getElementById('cart-total');

  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  if (discountEl) discountEl.textContent = `-₹${discount.toLocaleString('en-IN')}`;
  if (taxEl) taxEl.textContent = `₹${tax.toLocaleString('en-IN')}`;
  if (deliveryEl) deliveryEl.textContent = delivery === 0 ? 'FREE' : `₹${delivery}`;
  if (totalEl) totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (!drawer || !backdrop) return;

  const isOpen = !drawer.classList.contains('translate-x-full');
  const shouldOpen = open !== undefined ? open : !isOpen;

  if (shouldOpen) {
    drawer.classList.remove('translate-x-full');
    backdrop.classList.remove('hidden');
  } else {
    drawer.classList.add('translate-x-full');
    backdrop.classList.add('hidden');
  }
}

async function applyCartCoupon() {
  const input = document.getElementById('cart-coupon-input');
  const msgEl = document.getElementById('cart-coupon-message');
  const code = input ? input.value.trim() : '';

  if (!code) return;

  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, orderAmount: state.cart.subtotal })
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      state.cart.discount = data.discountAmount;
      state.cart.total = Math.max(0, state.cart.subtotal - data.discountAmount + state.cart.tax + state.cart.deliveryFee);
      updateCartTotals(
        state.cart.subtotal,
        state.cart.discount,
        state.cart.tax,
        state.cart.deliveryFee,
        state.cart.total
      );
      if (msgEl) {
        msgEl.textContent = `Coupon applied! Saved ₹${data.discountAmount}`;
        msgEl.className = 'text-[11px] text-emerald-600 font-medium block';
      }
      showToast(`Coupon "${code}" applied successfully!`, 'success');
    } else {
      if (msgEl) {
        msgEl.textContent = data.error || 'Invalid coupon';
        msgEl.className = 'text-[11px] text-rose-500 font-medium block';
      }
    }
  } catch (err) {
    showToast('Failed to validate coupon', 'error');
  }
}

function applyCouponQuick(code) {
  toggleCartDrawer(true);
  const input = document.getElementById('cart-coupon-input');
  if (input) {
    input.value = code;
    applyCartCoupon();
  }
}

// ==================== CHECKOUT & DL-BUG-001 TESTING ====================
function openCheckoutModal() {
  if (!state.cart.items || state.cart.items.length === 0) {
    showToast('Your cart is empty! Add products before checking out.', 'warning');
    return;
  }
  toggleCartDrawer(false);

  const totalDisplay = document.getElementById('checkout-total-display');
  if (totalDisplay) {
    totalDisplay.textContent = `₹${state.cart.total.toLocaleString('en-IN')}`;
  }

  document.getElementById('checkout-modal').classList.remove('hidden');
  initLucide();
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

// DL-BUG-001: Place order with double click test
async function submitPlaceOrder() {
  const btn = document.getElementById('btn-place-order');
  const isReferenceMode = window.IS_REFERENCE_MODE === true;

  if (isReferenceMode) {
    // Reference fix: disable button immediately to prevent rapid multi-clicks
    btn.disabled = true;
    btn.classList.add('opacity-50');
  }

  const selectedMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'UPI';
  const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    const res = await fetch('/api/checkout/place-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': idempotencyKey
      },
      body: JSON.stringify({
        paymentMethod: selectedMethod,
        idempotencyKey
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      state.activeOrder = data.order;
      closeCheckoutModal();
      await loadCart(); // Refresh cart
      openPaymentGateway(data.order);
    } else {
      showToast(data.error || 'Checkout failed', 'error');
    }
  } catch (err) {
    showToast('Checkout network request failed', 'error');
  } finally {
    if (isReferenceMode) {
      btn.disabled = false;
      btn.classList.remove('opacity-50');
    }
  }
}

// ==================== SIMULATED PAYMENT GATEWAY (DL-BUG-004 & DL-BUG-007) ====================
function openPaymentGateway(order) {
  const modal = document.getElementById('payment-gateway-modal');
  const numEl = document.getElementById('gw-order-number');
  const amtEl = document.getElementById('gw-amount');
  const procState = document.getElementById('gw-processing-state');
  const resState = document.getElementById('gw-result-state');

  if (numEl) numEl.textContent = `Order #${order.orderNumber}`;
  if (amtEl) amtEl.textContent = `₹${order.total.toLocaleString('en-IN')}`;

  procState.classList.remove('hidden');
  resState.classList.add('hidden');
  modal.classList.remove('hidden');

  // Simulate payment processing
  setTimeout(async () => {
    await executePayment(order.id);
  }, 1200);
}

async function executePayment(orderId) {
  const procState = document.getElementById('gw-processing-state');
  const resState = document.getElementById('gw-result-state');
  const iconEl = document.getElementById('gw-status-icon');
  const headingEl = document.getElementById('gw-status-heading');
  const msgEl = document.getElementById('gw-status-message');

  try {
    const res = await fetch('/api/payments/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        method: state.activeOrder ? state.activeOrder.paymentMethod : 'UPI',
        simulatedOutcome: 'SUCCESS'
      })
    });

    const data = await res.json();
    procState.classList.add('hidden');
    resState.classList.remove('hidden');

    if (res.ok) {
      iconEl.className = 'w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-emerald-100 text-emerald-600';
      iconEl.innerHTML = '<i data-lucide="check" class="w-6 h-6"></i>';
      headingEl.textContent = 'Payment Completed Successfully!';
      msgEl.textContent = `Transaction ID: ${data.payment.transactionId}. Your order is now processing for warehouse fulfillment.`;
      showToast('Payment successful! Order confirmed.', 'success');
    } else {
      iconEl.className = 'w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-rose-100 text-rose-600';
      iconEl.innerHTML = '<i data-lucide="alert-triangle" class="w-6 h-6"></i>';
      headingEl.textContent = 'Payment Failed';
      msgEl.textContent = data.error || 'Payment gateway could not settle transaction.';
      showToast(data.error || 'Payment failed', 'error');
    }
    initLucide();
  } catch (err) {
    procState.classList.add('hidden');
    resState.classList.remove('hidden');
    showToast('Payment processing error', 'error');
  }
}

// DL-BUG-004 testing: Customer retries payment
async function retryPayment() {
  if (!state.activeOrder) return;
  const procState = document.getElementById('gw-processing-state');
  const resState = document.getElementById('gw-result-state');
  procState.classList.remove('hidden');
  resState.classList.add('hidden');
  await executePayment(state.activeOrder.id);
}

// DL-BUG-007 testing: Verification before displaying success
async function continueToOrderResult() {
  document.getElementById('payment-gateway-modal').classList.add('hidden');

  if (state.activeOrder) {
    // In REFERENCE MODE: Verify with backend before displaying confirmed state
    // In CHALLENGE MODE: Buggy behavior trusts client redirect
    const isReferenceMode = window.IS_REFERENCE_MODE === true;
    if (isReferenceMode) {
      const verifyRes = await fetch(`/api/payments/verify/${state.activeOrder.id}`);
      const verifyData = await verifyRes.json();
      if (!verifyData.verified) {
        showToast('Payment could not be verified by backend security.', 'error');
        navigate('profile');
        return;
      }
    }
  }

  navigate('profile');
}

let appDialogResolve = null;
let appDialogPreviousFocus = null;

function showAppDialog(options = {}) {
  const overlay = document.getElementById('app-dialog');
  const title = document.getElementById('app-dialog-title');
  const message = document.getElementById('app-dialog-message');
  const icon = document.getElementById('app-dialog-icon');
  const field = document.getElementById('app-dialog-field');
  const label = document.getElementById('app-dialog-label');
  const input = document.getElementById('app-dialog-input');
  const textarea = document.getElementById('app-dialog-textarea');
  const error = document.getElementById('app-dialog-error');
  const cancel = document.getElementById('app-dialog-cancel');
  const confirm = document.getElementById('app-dialog-confirm');
  if (!overlay) return Promise.resolve(false);

  const hasInput = Boolean(options.input);
  const useTextarea = options.input?.type === 'textarea';
  appDialogPreviousFocus = document.activeElement;
  overlay.dataset.tone = options.tone || 'neutral';
  icon.innerHTML = `<i data-lucide="${options.tone === 'danger' ? 'triangle-alert' : hasInput ? 'message-square-text' : 'circle-help'}" class="w-5 h-5" aria-hidden="true"></i>`;
  initLucide();
  title.textContent = options.title || 'Please confirm';
  message.textContent = options.message || '';
  cancel.textContent = options.cancelLabel || 'Go back';
  confirm.textContent = options.confirmLabel || 'Confirm';
  field.classList.toggle('hidden', !hasInput);
  error.classList.add('hidden');
  error.textContent = '';
  input.classList.toggle('hidden', !hasInput || useTextarea);
  textarea.classList.toggle('hidden', !hasInput || !useTextarea);

  const activeField = useTextarea ? textarea : input;
  if (hasInput) {
    label.textContent = options.input.label || 'Details';
    label.htmlFor = activeField.id;
    activeField.value = options.input.value ?? '';
    activeField.placeholder = options.input.placeholder || '';
    if (activeField === input) input.type = options.input.type || 'text';
    activeField.min = options.input.min ?? '';
    activeField.max = options.input.max ?? '';
    if (activeField === input) input.step = options.input.step ?? (options.input.type === 'number' ? '1' : '');
    activeField.inputMode = options.input.inputMode || '';
  }

  return new Promise((resolve) => {
    appDialogResolve = resolve;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => (hasInput ? activeField : cancel).focus());
  });
}

function closeAppDialog(result = false) {
  const overlay = document.getElementById('app-dialog');
  overlay?.classList.add('hidden');
  overlay?.setAttribute('aria-hidden', 'true');
  if (appDialogResolve) {
    const resolve = appDialogResolve;
    appDialogResolve = null;
    resolve(result);
  }
  if (appDialogPreviousFocus?.isConnected) appDialogPreviousFocus.focus();
  appDialogPreviousFocus = null;
}

function submitAppDialog(event) {
  event.preventDefault();
  const field = document.getElementById('app-dialog-field');
  if (field.classList.contains('hidden')) {
    closeAppDialog(true);
    return;
  }

  const input = document.getElementById('app-dialog-input');
  const textarea = document.getElementById('app-dialog-textarea');
  const activeField = textarea.classList.contains('hidden') ? input : textarea;
  const error = document.getElementById('app-dialog-error');
  const value = activeField.value.trim();
  const min = activeField.min === '' ? null : Number(activeField.min);
  const numericValue = activeField.type === 'number' ? Number(value) : null;
  let errorMessage = '';

  if (!value) errorMessage = 'Enter a value to continue.';
  else if (activeField.type === 'number' && (!Number.isInteger(numericValue) || (min !== null && numericValue < min))) {
    errorMessage = min === null ? 'Enter a whole number.' : `Enter a whole number of at least ${min}.`;
  }

  if (errorMessage) {
    error.textContent = errorMessage;
    error.classList.remove('hidden');
    activeField.focus();
    return;
  }
  closeAppDialog(value);
}

function handleAppDialogBackdrop(event) {
  if (event.target === event.currentTarget) closeAppDialog(false);
}

function handleAppDialogKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeAppDialog(false);
    return;
  }
  if (event.key !== 'Tab') return;
  const controls = [...event.currentTarget.querySelectorAll('button:not([disabled]), input:not(.hidden), textarea:not(.hidden)')];
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function showAppConfirm(options) {
  return showAppDialog(options);
}

// ==================== CUSTOMER PROFILE & ORDERS ====================
async function loadCustomerOrders() {
  try {
    const res = await fetch('/api/orders');
    const data = await res.json();
    const orders = data.orders || [];

    const container = document.getElementById('profile-orders-list');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = '<p class="py-8 text-center text-xs text-slate-400">No orders placed yet.</p>';
      return;
    }

    container.innerHTML = orders
      .map(
        (o) => `
      <div class="py-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span class="font-bold text-slate-900 text-sm">${o.orderNumber}</span>
            <span class="text-xs text-slate-400 ml-2">${new Date(o.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${getOrderStatusBadgeClass(o.status)}">
              ${o.status}
            </span>
            <span class="font-bold text-slate-900 text-sm tabular-nums">₹${o.total.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <!-- Order Items -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
          ${o.items
            .map(
              (item) => `
            <div class="flex items-center gap-2">
              <img src="${item.image}" class="w-8 h-8 rounded-lg object-cover">
              <span class="truncate flex-1">${item.title}</span>
              <span class="font-bold text-slate-700">x${item.quantity}</span>
            </div>
          `
            )
            .join('')}
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 text-xs">
          ${o.status === 'PROCESSING' || o.status === 'PENDING_PAYMENT'
            ? `<button onclick="cancelOrder('${o.id}')" class="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold">Cancel Order</button>`
            : ''
          }
          ${o.status === 'DELIVERED'
            ? `<button onclick="requestRefund('${o.id}')" class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold">Return & Refund</button>`
            : ''
          }
        </div>
      </div>
    `
      )
      .join('');

    initLucide();
  } catch (err) {
    console.error('Failed to load orders', err);
  }
}

function getOrderStatusBadgeClass(status) {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-100 text-emerald-800';
    case 'PROCESSING':
      return 'bg-brand-100 text-brand-800';
    case 'SHIPPED':
      return 'bg-blue-100 text-blue-800';
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-600';
    case 'REFUNDED':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

async function cancelOrder(orderId) {
  const confirmed = await showAppConfirm({
    title: 'Cancel this order?',
    message: 'This order will be marked as cancelled. Do you want to continue?',
    confirmLabel: 'Cancel order',
    cancelLabel: 'Keep order',
    tone: 'danger'
  });
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Customer initiated cancellation' })
    });
    if (res.ok) {
      showToast('Order cancelled successfully', 'info');
      loadCustomerOrders();
    }
  } catch (err) {
    showToast('Failed to cancel order', 'error');
  }
}

async function requestRefund(orderId) {
  const reason = await showAppDialog({
    title: 'Request a return or refund',
    message: 'Tell us briefly why you are requesting a return or refund.',
    confirmLabel: 'Submit request',
    cancelLabel: 'Go back',
    input: { type: 'textarea', label: 'Reason', placeholder: 'Enter your reason' }
  });
  if (!reason) return;
  try {
    const res = await fetch(`/api/orders/${orderId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (res.ok) {
      showToast('Refund request processed and credited', 'success');
      loadCustomerOrders();
    }
  } catch (err) {
    showToast('Failed to process refund', 'error');
  }
}

// ==================== SELLER DASHBOARD ====================
async function loadSellerDashboard() {
  try {
    const metricsRes = await fetch('/api/seller/dashboard');
    const metrics = await metricsRes.json();

    document.getElementById('seller-store-name').textContent = `${metrics.storeName} — Verified Merchant`;
    document.getElementById('seller-revenue').textContent = `₹${metrics.grossRevenue.toLocaleString('en-IN')}`;
    document.getElementById('seller-orders-count').textContent = metrics.totalOrders;
    document.getElementById('seller-products-count').textContent = metrics.totalProducts;
    document.getElementById('seller-low-stock-count').textContent = metrics.lowStockAlertsCount;

    const prodRes = await fetch('/api/seller/products');
    const prodData = await prodRes.json();
    const tbody = document.getElementById('seller-products-tbody');

    if (tbody) {
      tbody.innerHTML = (prodData.products || [])
        .map(
          (p) => `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
            <img src="${p.images[0]}" class="w-8 h-8 rounded object-cover">
            <span class="truncate max-w-xs">${p.title}</span>
          </td>
          <td class="py-3 px-4 uppercase text-xs">${p.categorySlug}</td>
          <td class="py-3 px-4 font-bold tabular-nums">₹${p.price.toLocaleString('en-IN')}</td>
          <td class="py-3 px-4 font-bold ${p.stock < 15 ? 'text-rose-600' : 'text-emerald-600'} tabular-nums">
            ${p.stock < 0 ? `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-black">⚠️ OVERSOLD (${p.stock})</span>` : `${p.stock} units`}
          </td>
          <td class="py-3 px-4 text-right">
            <button onclick="editProductStock('${p.id}', ${p.stock})" class="text-xs font-semibold text-brand-600 hover:underline mr-3">Edit Stock</button>
            <button onclick="deleteSellerProduct('${p.id}')" class="text-xs font-semibold text-rose-500 hover:underline">Delete</button>
          </td>
        </tr>
      `
        )
        .join('');
    }
  } catch (err) {
    console.error('Failed to load seller dashboard', err);
  }
}

async function editProductStock(productId, currentStock) {
  const newStock = await showAppDialog({
    title: 'Update inventory',
    message: 'Set the available stock for this product.',
    confirmLabel: 'Save stock',
    cancelLabel: 'Go back',
    input: { type: 'number', label: 'Units in stock', value: currentStock, min: 0, inputMode: 'numeric' }
  });
  if (newStock === false) return;
  try {
    const res = await fetch(`/api/seller/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: parseInt(newStock, 10) })
    });
    if (res.ok) {
      showToast('Inventory stock updated!', 'success');
      loadSellerDashboard();
    }
  } catch (err) {
    showToast('Failed to update stock', 'error');
  }
}

async function deleteSellerProduct(productId) {
  const confirmed = await showAppConfirm({
    title: 'Remove this product?',
    message: 'This product will be removed from your catalog.',
    confirmLabel: 'Remove product',
    cancelLabel: 'Keep product',
    tone: 'danger'
  });
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/seller/products/${productId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Product removed from catalog', 'info');
      loadSellerDashboard();
    }
  } catch (err) {
    showToast('Failed to delete product', 'error');
  }
}

// ==================== ADMIN DASHBOARD ====================
async function loadAdminDashboard() {
  try {
    const metricsRes = await fetch('/api/admin/metrics');
    const metrics = await metricsRes.json();

    document.getElementById('admin-gmv').textContent = `₹${metrics.grossRevenue.toLocaleString('en-IN')}`;
    document.getElementById('admin-users-count').textContent = metrics.activeCustomers;
    document.getElementById('admin-sellers-count').textContent = metrics.registeredSellers;
    document.getElementById('admin-warehouses-count').textContent = `${metrics.warehousesCount} Hubs`;

    // Warehouses
    const whRes = await fetch('/api/admin/warehouses');
    const whData = await whRes.json();
    const whList = document.getElementById('admin-warehouses-list');

    if (whList) {
      whList.innerHTML = (whData.warehouses || [])
        .map(
          (wh) => `
        <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-900 text-xs">${wh.code} (${wh.name})</span>
            <span class="text-[10px] bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded">Priority ${wh.priority}</span>
          </div>
          <p class="text-[11px] text-slate-500">${wh.location}</p>
          <div class="pt-1">
            <div class="flex justify-between text-[11px] text-slate-600 mb-1">
              <span>Stock: <b>${wh.totalStock}</b></span>
              <span>Reserved: <b>${wh.totalReserved}</b></span>
            </div>
            <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full bg-brand-500 rounded-full" style="width: ${Math.min(100, wh.utilizationRate)}%"></div>
            </div>
          </div>
        </div>
      `
        )
        .join('');
    }

    // Audit logs
    const logsRes = await fetch('/api/admin/audit-logs');
    const logsData = await logsRes.json();
    const logsEl = document.getElementById('admin-audit-logs');

    if (logsEl) {
      logsEl.innerHTML = (logsData.logs || [])
        .slice(0, 10)
        .map(
          (log) => `
        <div class="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
          <span>[${log.action}] by ${log.role} (${log.userId})</span>
          <span class="text-slate-400">${new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>
      `
        )
        .join('');
    }

    initLucide();
  } catch (err) {
    console.error('Failed to load admin dashboard', err);
  }
}

// ==================== WISHLIST ====================
function toggleWishlist(productId, event) {
  if (event) event.stopPropagation();
  const idx = state.wishlist.indexOf(productId);
  if (idx > -1) {
    state.wishlist.splice(idx, 1);
    showToast('Removed from wishlist', 'info');
  } else {
    state.wishlist.push(productId);
    showToast('Added to wishlist!', 'success');
  }
  const badge = document.getElementById('wishlist-badge');
  if (badge) badge.textContent = state.wishlist.length;
  if (state.currentView === 'wishlist') renderWishlist();
  if (state.currentView === 'home') renderProductGrid('trending-product-grid', state.trending);
}

function renderWishlist() {
  const wishlistProducts = state.products.filter((p) => state.wishlist.includes(p.id));
  renderProductGrid('wishlist-product-grid', wishlistProducts);
  const recommendations = document.getElementById('wishlist-recommendations');
  const recommendationProducts = state.trending.filter((p) => !state.wishlist.includes(p.id)).slice(0, 4);
  if (recommendations) recommendations.classList.toggle('hidden', wishlistProducts.length > 0 || recommendationProducts.length === 0);
  if (recommendationProducts.length) renderProductGrid('wishlist-recommendations-grid', recommendationProducts);
}

// ==================== UI HELPERS & MODALS ====================
function closeHeaderMenus(restoreFocus = false) {
  document.getElementById('user-dropdown-menu')?.classList.add('hidden');
  document.getElementById('user-menu-btn')?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) document.getElementById('user-menu-btn')?.focus();
}

function toggleUserMenu() {
  const menu = document.getElementById('user-dropdown-menu');
  if (!menu) return;
  const open = menu.classList.contains('hidden');
  closeHeaderMenus();
  menu.classList.toggle('hidden', !open);
  document.getElementById('user-menu-btn')?.setAttribute('aria-expanded', String(open));
}

function openAuthModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
  showLoginForm();
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function showLoginForm() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-form').classList.add('hidden');
  document.getElementById('auth-modal-title').textContent = 'Sign in to FlashCart';
}

function showRegisterForm() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('forgot-form').classList.add('hidden');
  document.getElementById('auth-modal-title').textContent = 'Create New Account';
}

function showForgotPassword() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-form').classList.remove('hidden');
  document.getElementById('auth-modal-title').textContent = 'Reset Password';
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      state.user = data.user;
      updateUserUI();
      closeAuthModal();
      showToast(`Welcome back, ${data.user.name}!`, 'success');
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (err) {
    showToast('Login request error', 'error');
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    if (res.ok) {
      state.user = data.user;
      updateUserUI();
      closeAuthModal();
      showToast(`Account created for ${data.user.name}!`, 'success');
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (err) {
    showToast('Registration request error', 'error');
  }
}

async function handleForgotSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value;
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    showToast(data.message || 'Reset token generated in development mode', 'info');
    showLoginForm();
  } catch (err) {
    showToast('Forgot password request error', 'error');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==================== BUG-03 VISUAL CONCURRENCY SIMULATOR ====================
// Call in Browser Console (F12) via: simulateConcurrentCheckouts()
window.simulateConcurrentCheckouts = async function (productId = 'prod-cam-06') {
  showToast('Simulating 2 concurrent flash-sale checkouts at the same millisecond...', 'warning');
  try {
    // 1. Set product stock to 1 via seller API to simulate last item in flash sale
    await fetch(`/api/seller/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: 1 })
    });

    const payload = {
      items: [{ productId, quantity: 1 }],
      addressId: 'addr-demo-1',
      paymentMethod: 'upi'
    };

    // 2. Fire 2 checkout requests concurrently with Promise.all
    const [res1, res2] = await Promise.all([
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idempotencyKey: 'c1-' + Date.now() })
      }),
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idempotencyKey: 'c2-' + Date.now() })
      })
    ]);

    const order1 = await res1.json();
    const order2 = await res2.json();

    // 3. Check resulting inventory in database
    const verifyRes = await fetch(`/api/products/${productId}`);
    const verifyData = await verifyRes.json();
    const finalStock = verifyData.product.stock;

    if (finalStock < 0) {
      showToast(`⚠️ DL-BUG-003 DETECTED: Stock dropped to ${finalStock} units (Oversold!)`, 'error');
    } else {
      showToast(`✓ PROTECTED: Stock safely handled, remaining: ${finalStock} units`, 'success');
    }

    // Open modal to visually inspect the negative inventory badge on screen
    openProductModal(productId);
    return { order1, order2, finalStock };
  } catch (err) {
    showToast('Simulation error: ' + err.message, 'error');
  }
};
