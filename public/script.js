
// ─── Constants & Utilities ──────────────────────────────────────────────────
const STORE_CONSTANTS = {
  CATEGORIES: {
    MIDDLE_EASTERN: 'Middle Eastern Perfumes',
    INDIAN: 'Indian Perfumes',
    ATTARS: 'Attars',
    DEODORANTS: 'Deodorants'
  },
  GENDERS: {
    MEN: 'Men',
    WOMEN: 'Women',
    UNISEX: 'Unisex'
  },
  STOCK: {
    IN_STOCK: 'in stock',
    OUT_OF_STOCK: 'out of stock'
  }
};

/**
 * Universal API request wrapper that auto-injects admin tokens and handles errors
 */
async function apiRequest(url, options = {}) {
  const adminToken = sessionStorage.getItem('adminToken');
  const headers = { ...options.headers };
  if (adminToken) {
    headers['x-admin-token'] = adminToken;
  }
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    let errText = 'API Error';
    try {
      const errData = await response.json();
      errText = errData.error || errText;
    } catch(e) {
      errText = await response.text();
    }
    throw new Error(errText);
  }
  
  try {
    return await response.json();
  } catch(e) {
    return { success: true };
  }
}

/**
 * Price parsing helper
 */
function getNumericPrice(priceStr) {
  if (!priceStr) return 0;
  const parsed = parseFloat(String(priceStr).replace(/[^\d.]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}


let allProducts = []; // Store all products for search
let currentCategory = 'all'; // For category filtering
const STORE_WHATSAPP_NUMBER = '919407114022'; // Centralized WhatsApp number

// Load and display products on public pages
async function loadProducts(containerId, filterVisible = true) {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const products = await response.json();
    allProducts = filterVisible ? products.filter(p => p.visibility) : products;
    filterProducts();
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

// function renderProducts(containerId, products) {
//   const container = document.getElementById(containerId);
//   container.innerHTML = products.map(p => `
//     <a href="/product/${p.id}" class="product-card-link">
//       <div class="product-card">
//         <img src="${p.images[0] || '/uploads/default.jpg'}" alt="${p.name}">
//         <h3>${p.name}</h3>
//         <p>${p.size}</p>
//         <p class="price">₹${p.price} (Approx – confirm on WhatsApp)</p>
//         <p class="stock ${p.stock === 'out of stock' ? 'out-of-stock' : ''}">${p.stock}</p>
//         <button class="add-to-order-btn" onclick="event.preventDefault(); event.stopPropagation(); addToOrder(${p.id}, '${p.name.replace(/'/g, "\\'")}', '${p.size}', '${p.price}'); return false;" ${p.stock === 'out of stock' ? 'disabled' : ''}>
//           ${p.stock === 'out of stock' ? 'Out of Stock' : 'Add to Order'}
//         </button>
//       </div>
//     </a>
//   `).join('');
// }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderProducts(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = products.map(p => {
    const name = escapeHtml(p.name || '');
    const size = escapeHtml(p.size || '');
    const price = escapeHtml(p.price || '');
    const stock = escapeHtml(p.stock || '');
    const img = escapeHtml((p.images && p.images[0]) || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgNDAwIDQwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNGNUYwRUIiLz48dGV4dCB4PSIyMDAiIHk9IjE4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ4IiBmaWxsPSIjQ0NCOEE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn5mDPC90ZXh0Pjx0ZXh0IHg9IjIwMCIgeT0iMjQwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTg4NzciIHRleHQtYW5jaG9yPSJtaWRkbGUiPlBlcmZ1bWUgSW1hZ2U8L3RleHQ+PC9zdmc+');
    const stockClass = p.stock === 'out of stock' ? 'out-of-stock' : '';
    const isOutOfStock = p.stock === 'out of stock';

    // Safe JSON-encoded values for the onclick handler
    const safeId = Number(p.id);
    const safeName = (p.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeSize = (p.size || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safePrice = (p.price || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeImg = ((p.images && p.images[0]) || '/uploads/default.jpg').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    const cartBtn = isOutOfStock
      ? `<button class="card-cart-btn" disabled>Out of Stock</button>`
      : `<button class="card-cart-btn" onclick="event.preventDefault();event.stopPropagation();addToOrder(${safeId},'${safeName}','${safeSize}','${safePrice}','${safeImg}')">
           <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:5px"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
           Add to Cart
         </button>`;

    return `
      <div class="product-card">
        <a href="/product/${p.id}" class="product-card-link" style="display:block;text-decoration:none;color:inherit;">
          <img src="${img}" alt="${name}">
          <h3>${name}</h3>
          <p>${size}</p>
          <p class="price">&#8377;${price} (Approx)</p>
          <p class="stock ${stockClass}">${stock}</p>
        </a>
        <div class="card-cart-footer">
          ${cartBtn}
        </div>
      </div>
    `;
  }).join('');
  
  setTimeout(() => {
    if (typeof AOS !== 'undefined') AOS.refresh();
  }, 100);
}


// Load product detail
async function loadProductDetail() {
  const id = window.location.pathname.split('/').pop();
  let product;
  try {
    const response = await fetch(`/api/products/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    product = await response.json();
  } catch (err) {
    console.error('Failed to load product detail:', err);
    const container = document.getElementById('productDetail');
    if (container) container.innerHTML = '<p>Failed to load product details. Please try again.</p>';
    return;
  }
  if (product && product.visibility === false) {
    const container = document.getElementById('productDetail');
    if (container) container.innerHTML = '<p>This product is currently not available.</p>';
    return;
  }
  if (product) {
    // Ensure fields exist to avoid runtime crashes
    const images = Array.isArray(product.images) ? product.images : [];
    const safeStock = product.stock ?? '';
    const stockLabel = safeStock;

    let currentImageIndex = 0;
    const container = document.getElementById('productDetail');
    container.innerHTML = `
      <div class="detail-container">
        <div class="image-gallery">
          <div class="main-image-container" style="background: #FAF9F6; border-radius: 16px; border: 1px solid #EAE6DF; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
            ${images.length > 1 ? '<button class="gallery-btn" id="prevImage">‹</button>' : ''}
            <img id="mainImage" src="${escapeHtml(images[0] || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgNDAwIDQwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNGNUYwRUIiLz48dGV4dCB4PSIyMDAiIHk9IjE4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ4IiBmaWxsPSIjQ0NCOEE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn5mDPC90ZXh0Pjx0ZXh0IHg9IjIwMCIgeT0iMjQwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTg4NzciIHRleHQtYW5jaG9yPSJtaWRkbGUiPlBlcmZ1bWUgSW1hZ2U8L3RleHQ+PC9zdmc+')}" alt="${escapeHtml(String(product.name || ''))}">
            ${images.length > 1 ? '<button class="gallery-btn" id="nextImage">›</button>' : ''}
          </div>
          ${images.length > 1 ? `<div class="gallery-thumbs">${images.map((img, idx) => `<img src="${escapeHtml(img)}" onclick="changeImage(${idx})" class="${idx === 0 ? 'active' : ''}" alt="Thumbnail ${idx + 1}">`).join('')}</div>` : ''}
        </div>

        <div class="detail-info">
          <h1 style="font-family: 'Playfair Display', serif; font-size: 2.2rem; color: #1A1A1A; margin-bottom: 14px; font-weight: 700; line-height: 1.25;">${escapeHtml(product.name || '')}</h1>

          <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 18px;">
            <span style="background: #F4F1EA; color: #555; padding: 5px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 1px solid #E5DFD5;">${escapeHtml(product.size || '')}</span>
            <span style="background: #F4F1EA; color: #555; padding: 5px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 1px solid #E5DFD5;">${escapeHtml(product.gender || 'Unisex')}</span>
            <span style="background: #F4F1EA; color: #555; padding: 5px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 1px solid #E5DFD5;">${escapeHtml(product.category || 'Middle Eastern Perfumes')}</span>
            <span style="padding: 5px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; ${stockLabel === 'out of stock' ? 'background: #FFEBEB; color: #D9534F; border: 1px solid #FFC9C9;' : 'background: #E8F5E9; color: #2E7D32; border: 1px solid #C8E6C9;'}">
              ${stockLabel === 'out of stock' ? '🔴 Out of Stock' : '🟢 In Stock'}
            </span>
          </div>

          <div style="margin-bottom: 18px; display: flex; align-items: baseline; gap: 8px;">
            <span style="font-size: 1.8rem; font-weight: 700; color: #1A1A1A; font-family: 'Inter', sans-serif;">₹${escapeHtml(product.price || '')}</span>
            <span style="font-size: 0.85rem; color: #777;">(Approx – confirm on WhatsApp)</span>
          </div>

          <p style="color: #444; line-height: 1.65; font-size: 0.98rem; margin-bottom: 24px;">${escapeHtml(product.description || '')}</p>

          <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button onclick="addToOrder('${product.id}', '${escapeHtml((product.name || '').replace(/'/g, "\\'"))}', '${escapeHtml(product.size)}', '${escapeHtml(product.price)}', '${escapeHtml(images[0] || '')}')" class="btn btn-secondary" ${stockLabel === 'out of stock' ? 'disabled' : ''} style="flex: 1; cursor: pointer; font-weight: 600; padding: 14px; border-radius: 30px; border: 1.5px solid #1A1A1A; background: #FFF; color: #1A1A1A; transition: all 0.2s;">Add to Cart</button>
            <a href="https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi, I'm interested in " + (product.name || "") + " (" + (product.size || "") + ")!")}" class="btn btn-primary" ${stockLabel === 'out of stock' ? 'style="pointer-events: none; opacity: 0.5; flex: 1; padding: 14px; border-radius: 30px;"' : 'style="flex: 1; padding: 14px; border-radius: 30px; background: #1A1A1A; color: #FFF; font-weight: 600; text-align: center; text-decoration: none; box-shadow: 0 4px 14px rgba(0,0,0,0.15);"'}>Buy Now</a>
          </div>

          <div style="margin-top: 28px; padding: 20px; background: #FAF9F6; border: 1px solid #EAE6DF; border-radius: 14px; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.9rem; color: #333;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(212, 175, 55, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="18" height="18" fill="none" stroke="#D4AF37" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <span><strong>100% Authentic Product:</strong> Direct from authorized brand distributors</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.9rem; color: #333;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(212, 175, 55, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="18" height="18" fill="none" stroke="#D4AF37" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </div>
              <span><strong>Fast Dispatch:</strong> Dispatched within 24–48 hours across India</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.9rem; color: #333;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(37, 211, 102, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="18" height="18" fill="none" stroke="#25D366" stroke-width="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </div>
              <span><strong>WhatsApp Support:</strong> Real-time fragrance assistance & order tracking</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Store product for image changing
    window.currentProduct = product;
    window.currentImageIndex = 0;

    // Image navigation buttons (only if multiple images)
    if (product.images.length > 1) {
      document.getElementById('prevImage')?.addEventListener('click', () => {
        window.currentImageIndex = (window.currentImageIndex - 1 + product.images.length) % product.images.length;
        document.getElementById('mainImage').src = product.images[window.currentImageIndex];
        updateThumbnailActive(window.currentImageIndex);
      });

      document.getElementById('nextImage')?.addEventListener('click', () => {
        window.currentImageIndex = (window.currentImageIndex + 1) % product.images.length;
        document.getElementById('mainImage').src = product.images[window.currentImageIndex];
        updateThumbnailActive(window.currentImageIndex);
      });
    }
  }
}

// Change image in gallery
function changeImage(idx) {
  const product = window.currentProduct;
  if (!product) return;

  const images = Array.isArray(product.images) ? product.images : [];
  if (!images[idx]) return;

  window.currentImageIndex = idx;
  const mainImg = document.getElementById('mainImage');
  if (mainImg) mainImg.src = images[idx];
  updateThumbnailActive(idx);
}


// Update thumbnail active state
function updateThumbnailActive(idx) {
  document.querySelectorAll('.gallery-thumbs img').forEach((img, i) => {
    img.classList.toggle('active', i === idx);
  });
}
// Search and filter functionality
function filterProducts() {
  const query = document.getElementById('searchBar')?.value.toLowerCase() || '';

  // Get values from custom dropdowns
  const genderFilter = document.getElementById('dropdownGender')?.dataset.value || 'all';
  const priceRangeFilter = document.getElementById('dropdownPrice')?.dataset.value || 'all';
  const sortFilter = document.getElementById('dropdownSort')?.dataset.value || 'default';
  const availabilityFilter = document.getElementById('dropdownAvailability')?.dataset.value || 'all';

  let filtered = allProducts.filter(p =>
    (currentCategory === 'all' || (p.category && p.category.toLowerCase() === currentCategory.toLowerCase())) &&
    p.name.toLowerCase().includes(query)
  );

  // Gender filter
  if (genderFilter !== 'all') {
    filtered = filtered.filter(p => p.gender && p.gender.toLowerCase() === genderFilter.toLowerCase());
  }

  // Price range filter
  if (priceRangeFilter !== 'all') {
    filtered = filtered.filter(p => {
      const price = parseFloat(String(p.price).replace(/[^\d.]/g, '')) || 0;
      switch (priceRangeFilter) {
        case 'under_1000': return price < 1000;
        case '1000_2000': return price >= 1000 && price <= 2000;
        case '2000_3000': return price >= 2000 && price <= 3000;
        case '3000_5000': return price >= 3000 && price <= 5000;
        case 'over_5000': return price > 5000;
        default: return true;
      }
    });
  }

  // Availability filter
  if (availabilityFilter === 'instock') {
    filtered = filtered.filter(p => p.stock === 'in stock');
  }

  // Sort filter
  if (sortFilter === 'low') {
    filtered.sort((a, b) => {
      const priceA = parseFloat(String(a.price).replace(/[^\d.]/g, '')) || 0;
      const priceB = parseFloat(String(b.price).replace(/[^\d.]/g, '')) || 0;
      return priceA - priceB;
    });
  } else if (sortFilter === 'high') {
    filtered.sort((a, b) => {
      const priceA = parseFloat(String(a.price).replace(/[^\d.]/g, '')) || 0;
      const priceB = parseFloat(String(b.price).replace(/[^\d.]/g, '')) || 0;
      return priceB - priceA;
    });
  } else if (sortFilter === 'bestselling') {
    filtered = filtered.filter(p => p.is_bestseller === true);
  }
  // 'default' keeps original order

  renderProducts('allProducts', filtered);
}

// Category tabs
document.querySelectorAll('.tab-btn')?.forEach(btn => {
  btn.addEventListener('click', (e) => {
    currentCategory = e.target.dataset.category;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    filterProducts();
  });
});

// Custom Dropdown Handlers for Filter Panel
document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
  const header = dropdown.querySelector('.custom-dropdown-header');
  const options = dropdown.querySelectorAll('.custom-dropdown-option');

  // Toggle dropdown on header click
  header?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-dropdown').forEach(d => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
  });

  // Handle option selection
  options.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const value = option.dataset.value;
      dropdown.dataset.value = value;
      dropdown.querySelector('.custom-dropdown-header span').textContent = option.textContent.trim();
      dropdown.querySelectorAll('.custom-dropdown-option').forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      dropdown.classList.remove('open');
      filterProducts();
    });
  });
});

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
});

// Filter Panel Toggle
document.getElementById('filterToggleBtn')?.addEventListener('click', () => {
  const panel = document.getElementById('filterPanel');
  if (panel) {
    const isHidden = panel.style.display === 'none' || panel.style.display === '';
    panel.style.display = isHidden ? 'block' : 'none';
  }
});

// Search bar
let filterTimeout = null;
document.getElementById('searchBar')?.addEventListener('input', () => {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(filterProducts, 300);
});

// Admin login
// New: server-side auth uses X-Admin-Token header.
// Configure token in deployment and keep it private.
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');
  if (errorDiv) { errorDiv.style.display = 'none'; errorDiv.innerText = ''; }

  if (!username || !password) {
    if (errorDiv) { errorDiv.style.display = 'block'; errorDiv.innerText = 'Enter username and password'; }
    return;
  }

  // Clear any existing session before validating new credentials
  sessionStorage.removeItem('adminToken');
  document.getElementById('adminPanel').style.display = 'none';

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      if (errorDiv) { errorDiv.style.display = 'block'; errorDiv.innerText = 'Invalid username or password'; }
      return;
    }

    const data = await response.json();
    sessionStorage.setItem('adminToken', data.token);
    document.getElementById('adminPanel').style.display = 'block';
    const lc1 = document.getElementById('loginContainer');
    if (lc1) lc1.style.display = 'none';
    loadAdminProducts();
  } catch (err) {
    console.error('Login error:', err);
    if (errorDiv) { errorDiv.style.display = 'block'; errorDiv.innerText = 'Failed to connect to server. Please try again.'; }
  }
});

// Toggle password visibility
window.togglePassword = function () {
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } else {
    passwordInput.type = 'password';
    eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
};

// Logout admin
window.logoutAdmin = function () {
  sessionStorage.removeItem('adminToken');
  window.location.reload();
};


// Load products in admin
window.adminProducts = [];
window.adminActiveTab = 'full'; // 'full' or 'price'

async function loadAdminProducts() {
  try {
    const adminToken = sessionStorage.getItem('adminToken');
    const response = await fetch('/api/products', {
      headers: adminToken ? { 'x-admin-token': adminToken } : undefined
    });
    const products = await response.json();
    window.adminProducts = products.sort((a, b) => a.name.localeCompare(b.name));
    renderAdminProducts();
  } catch (err) {
    console.error('Failed to load admin products:', err);
    alert('Failed to load products. Please try again.');
  }
}

window.switchAdminTab = function (tabName) {
  window.adminActiveTab = tabName;
  document.getElementById('tab-full').classList.toggle('active', tabName === 'full');
  document.getElementById('tab-price').classList.toggle('active', tabName === 'price');

  const addBtn = document.getElementById('addProductBtn');
  if (addBtn) addBtn.style.display = tabName === 'full' ? 'inline-block' : 'none';

  renderAdminProducts();
};

window.renderAdminProducts = function () {
  const container = document.getElementById('productsList');
  if (!container) return;

  const searchInput = document.getElementById('adminSearch');
  const query = searchInput ? searchInput.value.toLowerCase() : '';

  const filtered = window.adminProducts.filter(p => {
    return p.name.toLowerCase().includes(query);
  });

  if (window.adminActiveTab === 'price') {
    container.innerHTML = filtered.map(p => {
      const name = escapeHtml(p.name || '');
      const price = escapeHtml(p.price || '');
      return `
        <div class="quick-price-row">
          <h4>${name}</h4>
          <div class="quick-price-controls">
            <input type="text" value="${price}" id="quick-price-${p.id}" class="form-control" oninput="document.getElementById('quick-btn-${p.id}').disabled = false; document.getElementById('quick-btn-${p.id}').innerHTML = 'Save';">
            <button class="btn" id="quick-btn-${p.id}" onclick="quickUpdatePrice(${p.id})" disabled style="padding: 8px 16px;">Saved</button>
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  // Full Manage Tab
  container.innerHTML = filtered.map(p => {
    const name = escapeHtml(p.name || '');
    const size = escapeHtml(p.size || '');
    const price = escapeHtml(p.price || '');
    const description = escapeHtml(p.description || '');
    const category = escapeHtml(p.category || '');
    const images = Array.isArray(p.images) ? p.images : [];

    return `
      <div class="admin-product-row" id="row-${p.id}" oninput="markDirty(${p.id})" onchange="markDirty(${p.id})">
        <h4>${name}</h4>
        
        <div>
          <input type="text" value="${name}" id="name-${p.id}" placeholder="Name">
          <small class="helper-text">Product name</small>
        </div>
        
        <div>
          <input type="text" value="${size}" id="size-${p.id}" placeholder="Size">
          <small class="helper-text">Size(e.g., 100ml EDP)</small>
        </div>
        
        <div>
          <input type="text" value="${price}" id="price-${p.id}" placeholder="Price">
          <small class="helper-text">Price</small>
        </div>
        
        <div>
          <select id="stock-${p.id}">
            <option value="in stock" ${p.stock === 'in stock' ? 'selected' : ''}>In stock</option>
            <option value="out of stock" ${p.stock === 'out of stock' ? 'selected' : ''}>Out of stock</option>
          </select>
          <small class="helper-text">Stock Availability</small>
        </div>
        
        <div>
          <label><input type="checkbox" id="visibility-${p.id}" ${p.visibility ? 'checked' : ''}> Visible</label>
          <br><label><input type="checkbox" id="bestseller-${p.id}" ${p.is_bestseller ? 'checked' : ''}> Best Seller</label>
          <small class="helper-text">Visibility and ranking.</small>
        </div>
        
        <div>
          <select id="category-${p.id}">
            <option value="Middle Eastern Perfumes" ${p.category === 'Middle Eastern Perfumes' ? 'selected' : ''}>Middle Eastern Perfumes</option>
            <option value="Indian Perfumes" ${p.category === 'Indian Perfumes' ? 'selected' : ''}>Indian Perfumes</option>
            <option value="Attars" ${p.category === 'Attars' ? 'selected' : ''}>Attars</option>
            <option value="Deodorants" ${p.category === 'Deodorants' ? 'selected' : ''}>Deodorants</option>
          </select>
          <small class="helper-text">Product category</small>
        </div>

        <div>
          <select id="gender-${p.id}">
            <option value="Unisex" ${(p.gender || 'Unisex') === 'Unisex' ? 'selected' : ''}>Unisex</option>
            <option value="Men" ${p.gender === 'Men' ? 'selected' : ''}>Men</option>
            <option value="Women" ${p.gender === 'Women' ? 'selected' : ''}>Women</option>
          </select>
          <small class="helper-text">Gender</small>
        </div>
        
        <div style="grid-column: 1 / -1;">
          <textarea id="description-${p.id}" placeholder="Description">${description}</textarea>
          <small class="helper-text">Description</small>
        </div>
        
        <div id="images-${p.id}" class="images-list">${images.map((img) => {
      const safeImg = escapeHtml(img || '');
      return `<div><input type="text" value="${safeImg}" oninput="markDirty(${p.id})"><button type="button" onclick="removeImage(this, ${p.id})">Remove</button></div>`;
    }).join('')}</div>
        
        <div style="grid-column: 1 / -1;">
          <input type="file" id="upload-${p.id}" accept="image/*" multiple>
          <small class="helper-text">Select images</small>
        </div>
        
        <button onclick="uploadImage(${p.id})">Upload Images</button>
        <button onclick="addImage(${p.id})">Add URL</button>
        <button class="btn" id="update-btn-${p.id}" onclick="updateProduct(${p.id})" disabled style="opacity: 0.5; cursor: not-allowed; transition: all 0.2s;">Update</button>
        <button class="btn" onclick="deleteProduct(${p.id})" style="background-color: #FF6B6B;">Delete</button>
      </div>
    `;
  }).join('');
};

window.removeImage = function(btn, id) {
  if (btn) {
    const parent = btn.closest('div');
    if (parent) parent.remove();
    markDirty(id);
  }
};



// Mark a product row as dirty (unsaved changes)
window.markDirty = function (id) {
  const btn = document.getElementById(`update-btn-${id}`);
  if (btn && btn.disabled) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.innerHTML = 'Update (Unsaved)';
    btn.style.backgroundColor = '#1A1A1A'; // Align with dark theme buttons
    btn.style.color = '#FFF';
  }
};

// Update product
async function updateProduct(id) {
  try {
    const name = document.getElementById(`name-${id}`).value;
    const size = document.getElementById(`size-${id}`).value;
    const price = document.getElementById(`price-${id}`).value;
    const stock = document.getElementById(`stock-${id}`).value;
    const visibility = document.getElementById(`visibility-${id}`).checked;
    const is_bestseller = document.getElementById(`bestseller-${id}`).checked;
    const category = document.getElementById(`category-${id}`).value;
    const gender = document.getElementById(`gender-${id}`).value;
    const description = document.getElementById(`description-${id}`).value;
    const images = Array.from(document.querySelectorAll(`#images-${id} input`)).map(input => input.value.trim()).filter(Boolean);
    const adminToken = sessionStorage.getItem('adminToken');
    const response = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { 'x-admin-token': adminToken } : {})
      },
      body: JSON.stringify({ name, size, price, stock, visibility, is_bestseller, category, gender, description, images })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    loadAdminProducts();
    if (window.location.pathname === '/products') loadProducts('allProducts');
  } catch (err) {
    console.error('Failed to update product:', err);
    alert('Failed to update product. Please try again.');
  }
}

window.quickUpdatePrice = async function (id) {
  try {
    const price = document.getElementById(`quick-price-${id}`).value;
    const product = window.adminProducts.find(p => p.id === id);
    if (!product) return;

    const payload = { ...product, price };
    const adminToken = sessionStorage.getItem('adminToken');
    const response = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { 'x-admin-token': adminToken } : {})
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const btn = document.getElementById(`quick-btn-${id}`);
    if (btn) {
      btn.innerHTML = 'Saved ✓';
      btn.disabled = true;
    }
    // Update local cache without full re-render
    product.price = price;
  } catch (err) {
    console.error('Failed to quick update price:', err);
    alert('Failed to update price. Please try again.');
  }
};

// Delete product
async function deleteProduct(id) {
  try {
    const adminToken = sessionStorage.getItem('adminToken');
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: adminToken ? { 'x-admin-token': adminToken } : undefined
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    loadAdminProducts();
    if (window.location.pathname === '/products') loadProducts('allProducts');
  } catch (err) {
    console.error('Failed to delete product:', err);
    alert('Failed to delete product. Please try again.');
  }
}

// Image management
async function uploadImage(id) {
  const fileInput = document.getElementById(`upload-${id}`);
  if (!fileInput.files || fileInput.files.length === 0) return alert('Select files first');
  try {
    const formData = new FormData();
    for (const file of fileInput.files) {
      formData.append('images', file); // Multiple files
    }
    formData.append('productId', id); // Pass productId for structured dir
    const adminToken = sessionStorage.getItem('adminToken');
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: adminToken ? { 'x-admin-token': adminToken } : undefined,
      body: formData
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.urls) {
      const imagesDiv = document.getElementById(`images-${id}`);
      data.urls.forEach(url => {
        const newInput = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = url;
        input.addEventListener('input', () => markDirty(id));
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
          newInput.remove();
          markDirty(id);
        });
        newInput.appendChild(input);
        newInput.appendChild(removeBtn);
        imagesDiv.appendChild(newInput);
      });
      fileInput.value = '';
      markDirty(id);
    } else {
      alert('Upload failed');
    }
  } catch (err) {
    console.error('Failed to upload image:', err);
    alert('Failed to upload image. Please try again.');
  }
}

function addImage(id) {
  const url = prompt('Enter image URL:');
  if (!url) return;

  const imagesDiv = document.getElementById(`images-${id}`);
  const newInput = document.createElement('div');

  const input = document.createElement('input');
  input.type = 'text';
  input.value = url;
  input.addEventListener('input', () => markDirty(id));

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Remove';
  btn.style.marginLeft = '8px';
  btn.addEventListener('click', () => {
    newInput.remove();
    markDirty(id);
  });

  newInput.appendChild(input);
  newInput.appendChild(btn);
  imagesDiv.appendChild(newInput);
  markDirty(id);
}

// Legacy removeImage function removed

// Show add form (replaced prompts/alerts flow)
function showAddForm() {
  // Create a non-blocking modal so pressing Enter doesn't trigger page submits/restart prompts
  let modal = document.getElementById('addProductModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'addProductModal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.background = 'rgba(0,0,0,0.5)';
  modal.style.zIndex = '5000';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  const modalContent = document.createElement('div');
  modalContent.style.background = '#fff';
  modalContent.style.width = 'min(900px, 95vw)';
  modalContent.style.maxHeight = '85vh';
  modalContent.style.overflow = 'auto';
  modalContent.style.borderRadius = '10px';
  modalContent.style.padding = '20px';

  modalContent.innerHTML = `
    <h3 style="margin-top:0">Add Product</h3>
    <div style="display:grid;grid-template-columns: repeat(auto-fit, minmax(220px,1fr));gap:14px;">
      <div style="display:flex;flex-direction:column;gap:5px;">
        <label>Name</label>
        <input type="text" id="add-name" required class="form-control" style="width:100%;margin:0;" />
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        <label>Size</label>
        <input type="text" id="add-size" required class="form-control" style="width:100%;margin:0;" />
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        <label>Price</label>
        <input type="text" id="add-price" required class="form-control" style="width:100%;margin:0;" />
      </div>
      <div>
        <label>Stock</label>
        <select id="add-stock" style="width:100%;padding:10px;">
          <option value="in stock">in stock</option>
          <option value="out of stock">out of stock</option>
        </select>
      </div>
      <div>
        <label>Category</label>
        <select id="add-category" style="width:100%;padding:10px;">
          <option value="Middle Eastern Perfumes">Middle Eastern Perfumes</option>
          <option value="Indian Perfumes">Indian Perfumes</option>
          <option value="Attars">Attars</option>
          <option value="Deodorants">Deodorants</option>
        </select>
      </div>
      <div>
        <label>Gender</label>
        <select id="add-gender" style="width:100%;padding:10px;">
          <option value="Unisex">Unisex</option>
          <option value="Men">Men</option>
          <option value="Women">Women</option>
        </select>
      </div>
      <div style="grid-column: 1 / -1;">
        <label>Description</label>
        <textarea id="add-description" style="width:100%;padding:10px;min-height:90px;"></textarea>
      </div>
      <div style="grid-column: 1 / -1;">
        <label><input type="checkbox" id="add-visibility" checked /> Visible on public site</label>
        <br><label><input type="checkbox" id="add-bestseller" /> Best Seller</label>
      </div>

      <div style="grid-column: 1 / -1;">
        <label>Images (URLs)</label>
        <div id="add-images" style="display:flex;flex-direction:column;gap:10px;margin-top:8px;"></div>
        <button type="button" class="btn" onclick="addImageUrlRow()">Add Image URL</button>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-top:18px;">
      <button type="button" class="btn" id="add-save">Save</button>
      <button type="button" class="btn" style="background:#ddd;color:#333" id="add-cancel">Cancel</button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Helper functions scoped on window for inline handlers
  window.addImageUrlRow = function () {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '10px';
    wrap.style.alignItems = 'center';

    const input = document.createElement('input');
    input.type = 'url';
    input.placeholder = 'https://example.com/image.jpg';
    input.className = 'form-control';
    input.style.flex = '1';
    input.style.padding = '10px';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.className = 'btn-secondary';
    remove.style.border = 'none';
    remove.style.borderRadius = '6px';
    remove.style.padding = '10px 14px';
    remove.style.cursor = 'pointer';

    remove.addEventListener('click', () => wrap.remove());

    wrap.appendChild(input);
    wrap.appendChild(remove);
    document.getElementById('add-images').appendChild(wrap);
  };

  // initial row
  window.addImageUrlRow();

  // Cancel/close
  const close = () => {
    modal.remove();
    window.addImageUrlRow = undefined;
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modalContent.querySelector('#add-cancel').addEventListener('click', close);

  // Save
  modalContent.querySelector('#add-save').addEventListener('click', async () => {
    const name = document.getElementById('add-name').value.trim();
    const size = document.getElementById('add-size').value.trim();
    const price = document.getElementById('add-price').value.trim();
    const stock = document.getElementById('add-stock').value;
    const category = document.getElementById('add-category').value;
    const gender = document.getElementById('add-gender').value;
    const description = document.getElementById('add-description').value;
    const visibility = document.getElementById('add-visibility').checked;
    const is_bestseller = document.getElementById('add-bestseller').checked;

    const imageInputs = Array.from(document.querySelectorAll('#add-images input[type="text"]'));
    const images = imageInputs.map(i => i.value.trim()).filter(Boolean);

    if (!name || !size || !price || !stock || !category || images.length === 0) {
      alert('Please fill all required fields and add at least 1 image URL.');
      return;
    }

    const saveBtn = modalContent.querySelector('#add-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      const adminToken = sessionStorage.getItem('adminToken');
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {})
        },
        body: JSON.stringify({ name, size, price, stock, visibility, category, gender, description, is_bestseller, images })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to save product: ${err.error || res.status}`);
        return;
      }

      close();
      loadAdminProducts();
    } catch (err) {
      console.error('Save product error:', err);
      alert('Network error — product was not saved. Please try again.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Product';
    }
  });
}


// Initialize based on page
if (window.location.pathname === '/products') {
  loadProducts('allProducts'); // Products page: Load and enable search/filter
} else if (window.location.pathname.startsWith('/product/')) {
  loadProductDetail(); // Product detail page
} else if (window.location.pathname === '/admin' || window.location.pathname === '/admin.html') {
  const token = sessionStorage.getItem('adminToken');
  if (token) {
    const lc2 = document.getElementById('loginContainer');
    if (lc2) lc2.style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAdminProducts();
  }
}

// ============================================
// MOBILE NAVBAR TOGGLE
// ============================================
(function () {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  const overlay = document.getElementById('navOverlay');

  if (!toggle || !menu) return;

  function openMenu() {
    menu.classList.add('open');
    toggle.classList.add('active');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    menu.classList.remove('open');
    toggle.classList.remove('active');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    if (menu.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay?.addEventListener('click', closeMenu);

  // Close menu when a nav link is clicked
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });
})();

// ============================================
// NAVBAR SEARCH OVERLAY
// ============================================
(function () {
  const searchToggle = document.getElementById('navSearchToggle');
  const searchOverlay = document.getElementById('navSearchOverlay');
  const searchInput = document.getElementById('navSearchInput');
  const searchClose = document.getElementById('navSearchClose');
  const searchBox = document.querySelector('.nav-search-box');

  if (!searchToggle || !searchOverlay || !searchBox || !searchInput) return;

  // Inject search results container
  let resultsContainer = document.getElementById('navSearchResults');
  if (!resultsContainer) {
    resultsContainer = document.createElement('div');
    resultsContainer.id = 'navSearchResults';
    resultsContainer.className = 'nav-search-results';
    searchBox.appendChild(resultsContainer);
  }

  let searchProducts = null;

  async function openSearch() {
    searchOverlay.classList.add('active');
    setTimeout(() => searchInput?.focus(), 50);

    // Fetch products if not already loaded
    if (!searchProducts) {
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const data = await response.json();
          searchProducts = data.filter(p => p.visibility);
        }
      } catch (err) {
        console.error('Failed to load products for search', err);
      }
    }
  }

  function closeSearch() {
    searchOverlay.classList.remove('active');
    resultsContainer.classList.remove('active');
    searchInput.value = '';
  }

  searchToggle.addEventListener('click', openSearch);
  searchClose?.addEventListener('click', closeSearch);

  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });

  let searchTimeout = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.trim().toLowerCase();

      if (!query) {
        resultsContainer.classList.remove('active');
        return;
      }

      if (searchProducts) {
        const filtered = searchProducts.filter(p => p.name.toLowerCase().includes(query));

        if (filtered.length === 0) {
          resultsContainer.innerHTML = '<div class="search-result-empty">No perfumes found</div>';
        } else {
          resultsContainer.innerHTML = filtered.slice(0, 5).map(p => {
            const img = p.images && p.images[0] ? escapeHtml(p.images[0]) : '/uploads/default.jpg';
            return `
              <a href="/product/${p.id}" class="search-result-item">
                <img src="${img}" alt="${escapeHtml(p.name)}">
                <div class="search-result-details">
                  <span class="search-result-name">${escapeHtml(p.name)}</span>
                  <span class="search-result-price">₹${escapeHtml(p.price)}</span>
                </div>
              </a>
            `;
          }).join('');
        }
        resultsContainer.classList.add('active');
      }
    }, 300);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch();
      return;
    }
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (window.location.pathname === '/products') {
        const productsSearchBar = document.getElementById('searchBar');
        if (productsSearchBar) {
          productsSearchBar.value = query;
          productsSearchBar.dispatchEvent(new Event('input'));
        }
        closeSearch();
      } else if (query) {
        window.location.href = `/products?search=${encodeURIComponent(query)}`;
      }
    }
  });
})();

// Pre-fill products page search bar from URL param (?search=...)
if (window.location.pathname === '/products') {
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const productsSearchBar = document.getElementById('searchBar');
    if (productsSearchBar) {
      // Wait for products to load first
      const fillSearch = () => {
        productsSearchBar.value = searchQuery;
        productsSearchBar.dispatchEvent(new Event('input'));
      };
      setTimeout(fillSearch, 300);
    }
  }
}

// MULTI-PRODUCT WHATSAPP ORDER SYSTEM (Guest Cart with PostgreSQL)
// 1. Session ID Management
function getGuestId() {
  const match = document.cookie.match(new RegExp('(^| )guest_id=([^;]+)'));
  if (match) return match[2];

  // Generate a cryptographically secure random ID if none exists
  const newId = 'guest_' + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9) + Date.now().toString(36));
  document.cookie = `guest_id=${newId}; path=/; max-age=31536000; SameSite=Lax`; // 1 year expiry
  return newId;
}

// Get guest ID on load
const guestId = getGuestId();
let cartItems = [];

function getCartHeaders() {
  const headers = { 'x-guest-id': guestId };
  const userToken = localStorage.getItem('userToken');
  if (userToken) headers['x-user-token'] = userToken;
  return headers;
}

// Fetch cart from database
async function fetchCart() {
  try {
    const res = await fetch('/api/cart', { headers: getCartHeaders() });
    if (!res.ok) throw new Error(`Cart fetch failed: ${res.status}`);
    cartItems = await res.json();
    updateOrderUI();
  } catch (err) {
    console.error('Failed to fetch cart', err);
  }
}

// Add product to order
window.addToOrder = async function (productId, name, size, price, image = null) {
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { ...getCartHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, name, size, price, image })
    });
    if (!res.ok) throw new Error(`Add to cart failed: ${res.status}`);
    cartItems = await res.json();
    updateOrderUI();
    showOrderNotification('Added to cart ✓');
  } catch (err) {
    console.error('Failed to add to cart', err);
    alert('Failed to add item to cart');
  }
};

window.updateQuantity = async function (productId, quantity) {
  if (quantity < 1) {
    return window.removeFromOrder(productId);
  }
  try {
    const res = await fetch(`/api/cart/${productId}`, {
      method: 'PUT',
      headers: { ...getCartHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity })
    });
    if (!res.ok) throw new Error(`Update quantity failed: ${res.status}`);
    cartItems = await res.json();
    updateOrderUI();
    renderOrderItems();
  } catch (err) {
    console.error('Failed to update quantity', err);
  }
};

// Remove item from order
window.removeFromOrder = async function (productId) {
  try {
    const res = await fetch(`/api/cart/${productId}`, {
      method: 'DELETE',
      headers: getCartHeaders()
    });
    if (!res.ok) throw new Error(`Remove from cart failed: ${res.status}`);
    cartItems = await res.json();
    updateOrderUI();
    renderOrderItems();
  } catch (err) {
    console.error('Failed to remove item', err);
  }
};

// Clear entire order
window.clearOrder = async function () {
  try {
    await fetch('/api/cart', {
      method: 'DELETE',
      headers: getCartHeaders()
    });
    cartItems = [];
    updateOrderUI();
    renderOrderItems();
  } catch (err) {
    console.error('Failed to clear cart', err);
  }
};

// Update UI
function updateOrderUI() {
  let floatBtn = document.getElementById('orderFloat');
  if (!floatBtn) return;

  const countEl = document.getElementById('orderCount');

  if (cartItems.length > 0) {
    floatBtn.style.display = 'block';
    const totalCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    countEl.textContent = totalCount;
  } else {
    floatBtn.style.display = 'none';
    closeOrderModal();
  }
}

window.showOrderModal = function () {
  let modal = document.getElementById('orderModal');
  if (modal) {
    modal.style.display = 'flex';
    renderOrderItems();
  }
};

window.closeOrderModal = function () {
  let modal = document.getElementById('orderModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

// Render items in modal
function renderOrderItems() {
  const container = document.getElementById('orderItemsList');
  if (!container) return;

  if (cartItems.length === 0) {
    container.innerHTML = '<p class="empty-order">No items in your cart yet.</p>';
    return;
  }

  let total = 0;
  container.innerHTML = cartItems.map(item => {
    const qty = item.quantity || 1;
    const priceStr = String(item.price).replace(/[^0-9.]/g, '');
    const price = parseFloat(priceStr) || 0;
    total += price * qty;

    return `
    <div class="order-item" style="display: flex; align-items: center; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #E0E0E0;">
      <div style="display: flex; align-items: center; flex: 1;">
        ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" style="width: 60px; height: 60px; object-fit: contain; margin-right: 15px; border-radius: 8px; background: #f8f8f8; border: 1px solid #eee;">` : ''}
        <div class="order-item-info" style="display: flex; flex-direction: column; flex: 1;">
          <strong style="font-size: 1rem; margin-bottom: 4px;">${escapeHtml(item.name)}</strong>
          <span style="font-size: 0.85rem; color: #666; margin-bottom: 4px;">${escapeHtml(item.size)}</span>
          <span class="order-item-price" style="font-size: 0.95rem; color: #D4AF37; font-weight: 600;">₹${escapeHtml(item.price)}</span>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
        <div style="display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
          <button onclick="updateQuantity('${escapeHtml(item.productId)}', ${qty - 1})" style="width: 28px; height: 28px; background: #f5f5f5; border: none; cursor: pointer; font-size: 1.1rem; color: #333; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">−</button>
          <span style="width: 32px; text-align: center; font-size: 0.95rem; font-weight: 500;">${qty}</span>
          <button onclick="updateQuantity('${escapeHtml(item.productId)}', ${qty + 1})" style="width: 28px; height: 28px; background: #f5f5f5; border: none; cursor: pointer; font-size: 1.1rem; color: #333; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">+</button>
        </div>
        <button onclick="removeFromOrder('${escapeHtml(item.productId)}')" class="remove-item-btn" style="background: none; border: none; font-size: 0.85rem; color: #d9534f; cursor: pointer; padding: 0; text-decoration: underline;">Remove</button>
      </div>
    </div>
  `;
  }).join('');

  if (total > 0) {
    container.innerHTML += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0; margin-top: 10px; border-top: 2px solid #333;">
        <strong style="font-size: 1.1rem;">Total Estimated Price:</strong>
        <strong style="font-size: 1.2rem; color: #D4AF37;">₹${total.toLocaleString('en-IN')}</strong>
      </div>
    `;
  }
}

// Send to WhatsApp
window.sendToWhatsApp = function () {
  if (cartItems.length === 0) {
    alert('Your cart is empty!');
    return;
  }
  let message = 'Hi, I want to order:\n\n';
  let total = 0;
  cartItems.forEach((item, index) => {
    const qty = item.quantity || 1;
    const priceStr = String(item.price).replace(/[^0-9.]/g, '');
    const price = parseFloat(priceStr) || 0;
    total += price * qty;
    message += `${index + 1}. ${item.name} (${item.size}) - Qty: ${qty}\n`;
  });
  if (total > 0) {
    message += `\n*Estimated Total: ₹${total.toLocaleString('en-IN')}*\n`;
  }
  message += '\nPlease confirm availability.';

  // WhatsApp number
  const url = `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

// Notification toast
function showOrderNotification(message) {
  let notification = document.getElementById('orderNotification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'orderNotification';
    notification.className = 'order-notification';
    document.body.appendChild(notification);
  }
  notification.textContent = message;
  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Inject UI on load
(function injectCartUI() {
  if (document.getElementById('orderFloat')) return; // Already injected
  if (window.location.pathname.startsWith('/admin')) return; // Don't show cart on admin pages

  // 1. Float Button
  const floatBtn = document.createElement('div');
  floatBtn.id = 'orderFloat';
  floatBtn.className = 'order-float';
  floatBtn.style.display = 'none'; // Hidden by default
  floatBtn.innerHTML = `
    <button class="order-btn" id="viewOrderBtn">
      🛒 View Cart <span id="orderCount" class="order-count">0</span>
    </button>
  `;
  document.body.appendChild(floatBtn);

  // 2. Modal
  const modal = document.createElement('div');
  modal.id = 'orderModal';
  modal.className = 'order-modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="order-modal-content">
      <div class="order-modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E0E0E0; padding-bottom: 15px; margin-bottom: 15px;">
        <h2 style="margin: 0; font-size: 1.5rem;">Your Cart</h2>
        <button class="close-modal" id="closeOrderModalBtn" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #333;">&times;</button>
      </div>
      <div class="order-items-list" id="orderItemsList" style="max-height: 50vh; overflow-y: auto; margin-bottom: 20px;"></div>
      <div class="order-modal-footer" style="display: flex; justify-content: space-between; gap: 10px;">
        <button class="btn btn-secondary" onclick="clearOrder()" style="flex: 1; padding: 12px; cursor: pointer;">Clear Cart</button>
        <button class="btn btn-primary" onclick="sendToWhatsApp()" style="flex: 2; padding: 12px; font-weight: bold; cursor: pointer;">Checkout via WhatsApp</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Events
  document.getElementById('viewOrderBtn').addEventListener('click', showOrderModal);
  document.getElementById('closeOrderModalBtn').addEventListener('click', closeOrderModal);
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'orderModal') closeOrderModal();
  });

  // Fetch initial cart state
  fetchCart();
})();

// Initialize AOS (Animate On Scroll)
if (typeof AOS !== 'undefined') {
  AOS.init({
    once: true,
    offset: 50,
  });
}

// ============================================
// USER AUTHENTICATION
// ============================================
let isAuthLoginMode = true;

window.openAuthModal = function () {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'block';
  const err = document.getElementById('authError');
  if (err) err.style.display = 'none';
  const form = document.getElementById('authForm');
  if (form) form.reset();
}

window.closeAuthModal = function () {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
}

window.toggleAuthMode = function (e) {
  e.preventDefault();
  isAuthLoginMode = !isAuthLoginMode;
  document.getElementById('authUsernameGroup').style.display = isAuthLoginMode ? 'none' : 'block';
  document.getElementById('authModalTitle').innerText = isAuthLoginMode ? 'Sign In' : 'Create Account';
  document.getElementById('authSubmitBtn').innerText = isAuthLoginMode ? 'Sign In' : 'Sign Up';
  document.getElementById('authToggleText').innerText = isAuthLoginMode ? "Don't have an account?" : "Already have an account?";
  document.getElementById('authToggleLink').innerText = isAuthLoginMode ? 'Create one' : 'Sign in';
  document.getElementById('authEmail').placeholder = isAuthLoginMode ? 'Email or Username' : 'Email';
}

window.toggleAuthPassword = function () {
  const pwd = document.getElementById('authPassword');
  const eye = document.getElementById('authEyeIcon');
  if (pwd.type === 'password') {
    pwd.type = 'text';
    eye.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } else {
    pwd.type = 'password';
    eye.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  }
}

document.getElementById('authForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const username = document.getElementById('authUsername').value;
  const errorDiv = document.getElementById('authError');

  errorDiv.style.display = 'none';

  const endpoint = isAuthLoginMode ? '/api/auth/login' : '/api/auth/register';
  const body = isAuthLoginMode ? { username: email, password, guest_id: guestId } : { username, email, password, guest_id: guestId };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      errorDiv.style.display = 'block';
      errorDiv.innerText = data.error || 'Authentication failed';
      return;
    }

    localStorage.setItem('userToken', data.token);
    localStorage.setItem('userName', data.username);
    closeAuthModal();
    // Redirect to account page after login/register
    window.location.href = '/account';
  } catch (err) {
    errorDiv.style.display = 'block';
    errorDiv.innerText = 'Network error. Please try again.';
  }
});

function updateAuthUI() {
  const token = localStorage.getItem('userToken');
  const name = localStorage.getItem('userName');
  const authBtn = document.getElementById('navUserAuthBtn');
  if (!authBtn) return;

  if (token) {
    authBtn.title = `Account: ${name}`;
    authBtn.onclick = () => { window.location.href = '/account'; };
  } else {
    authBtn.title = 'Sign In';
    authBtn.onclick = openAuthModal;
  }
}

window.logoutUser = function (e) {
  if (e) e.stopPropagation();
  localStorage.removeItem('userToken');
  localStorage.removeItem('userName');
  updateAuthUI();
}

// Call updateAuthUI on load
updateAuthUI();


// --- Reviews & Admin Tabs Logic ---
window.switchAdminSection = function (section) {
  if (section === 'products') {
    document.getElementById('section-products').style.display = 'block';
    document.getElementById('section-reviews').style.display = 'none';
    document.getElementById('tab-section-products').classList.add('active');
    document.getElementById('tab-section-reviews').classList.remove('active');
  } else {
    document.getElementById('section-products').style.display = 'none';
    document.getElementById('section-reviews').style.display = 'block';
    document.getElementById('tab-section-products').classList.remove('active');
    document.getElementById('tab-section-reviews').classList.add('active');
    fetchAdminReviews();
  }
};

window.fetchAdminReviews = async function () {
  const list = document.getElementById('adminReviewsList');
  if (!list) return;

  const token = sessionStorage.getItem('adminToken');
  try {
    const res = await fetch('/api/admin/store-reviews', {
      headers: { 'x-admin-token': token }
    });
    if (!res.ok) throw new Error('Failed to load');
    const reviews = await res.json();
    
    if (reviews.length === 0) {
      list.innerHTML = '<p style="color: #888; font-style: italic;">No reviews found.</p>';
      return;
    }
    
    list.innerHTML = reviews.map(r => `
      <div style="background: #FFF; padding: 15px; border-radius: 8px; border: 1px solid #EAEAEA; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="display: flex; gap: 4px; color: #FFD700; margin-bottom: 5px;">
            ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
          </div>
          <strong style="display: block; margin-bottom: 5px;">${r.author_name || r.reviewer_name || 'Anonymous'}</strong>
          <p style="margin: 0; color: #555; font-size: 0.9rem;">"${r.content || r.comment}"</p>
          <small style="color: #999;">${new Date(r.created_at).toLocaleDateString()}</small>
        </div>
        <div style="display: flex; gap: 10px; flex-shrink: 0;">
          <button class="btn" style="background: ${r.is_approved ? '#E0E0E0' : '#FFD700'}; color: #333;" onclick="approveReview('${r.id}')">${r.is_approved ? 'Disapprove' : 'Approve'}</button>
          ${r.is_approved ? `<button class="btn" style="background: ${r.is_featured ? '#9C27B0' : '#E0E0E0'}; color: ${r.is_featured ? '#FFF' : '#333'};" onclick="toggleFeatureReview('${r.id}')">${r.is_featured ? '★ Featured' : 'Feature'}</button>` : ''}
          <button class="btn" style="background: #FF6B6B;" onclick="deleteReview('${r.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p style="color: #FF6B6B;">Error loading reviews.</p>';
  }
};

window.approveReview = async function(id) {
  const token = sessionStorage.getItem('adminToken');
  try {
    const res = await fetch('/api/admin/store-reviews/' + id + '/approve', {
      method: 'PUT',
      headers: { 'x-admin-token': token }
    });
    if (res.ok) fetchAdminReviews();
  } catch(e) {}
};

window.toggleFeatureReview = async function(id) {
  const token = sessionStorage.getItem('adminToken');
  try {
    const res = await fetch('/api/admin/store-reviews/' + id + '/feature', {
      method: 'PUT',
      headers: { 'x-admin-token': token }
    });
    if (res.ok) fetchAdminReviews();
  } catch(e) {}
};

window.deleteReview = async function(id) {
  if (!confirm('Delete review?')) return;
  const token = sessionStorage.getItem('adminToken');
  try {
    const res = await fetch('/api/admin/store-reviews/' + id, {
      method: 'DELETE',
      headers: { 'x-admin-token': token }
    });
    if (res.ok) fetchAdminReviews();
  } catch(e) {}
};

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('userToken')) {
    document.querySelectorAll('.nav-create-account').forEach(el => {
      if (el.parentElement && el.parentElement.tagName === 'LI') {
        el.parentElement.style.display = 'none';
      } else {
        el.style.display = 'none';
      }
    });
  }
});


// ─── Homepage Reviews ─────────────────────────────────────────────────────
(function fetchAndRenderReviews() {
  const carousel = document.getElementById('reviewsCarousel');
  if (!carousel) return;

  fetch('/api/store-reviews?featured=true')
    .then(r => r.ok ? r.json() : [])
    .then(reviews => {
      if (!reviews.length) {
        carousel.innerHTML = '<p style="color:#888;font-style:italic;padding:20px;">No featured reviews yet.</p>';
        return;
      }
      carousel.innerHTML = reviews.map(r => `
        <div class="review-card" style="flex: 0 0 280px; scroll-snap-align: start; background: #1A1A1A; color: #FFF; padding: 26px 24px; border-radius: 18px; box-shadow: 0 10px 25px rgba(0,0,0,0.12); display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s ease;">
          <div>
            <div style="display: flex; gap: 4px; color: #FFD700; font-size: 1.1rem; margin-bottom: 16px;">
              ${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}
            </div>
            <p style="margin: 0 0 20px; color: #FFFFFF; font-size: 0.98rem; line-height: 1.5; font-style: italic;">&ldquo;${r.content || r.comment || ''}&rdquo;</p>
          </div>
          <div>
            <strong style="font-size: 0.85rem; color: #AAAAAA; letter-spacing: 1px; font-weight: 600; text-transform: uppercase;">&mdash; ${escapeHtml(r.author_name || r.reviewer_name || 'Anonymous')}</strong>
          </div>
        </div>
      `).join('');

      // Autoscroll logic
      if (reviews.length > 1) {
        let scrollInterval;
        const startAutoScroll = () => {
          scrollInterval = setInterval(() => {
            const maxScroll = carousel.scrollWidth - carousel.clientWidth;
            if (carousel.scrollLeft >= maxScroll - 15) {
              carousel.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
              carousel.scrollBy({ left: 344, behavior: 'smooth' });
            }
          }, 3500);
        };

        const stopAutoScroll = () => clearInterval(scrollInterval);

        carousel.addEventListener('mouseenter', stopAutoScroll);
        carousel.addEventListener('mouseleave', startAutoScroll);
        carousel.addEventListener('touchstart', stopAutoScroll, { passive: true });
        carousel.addEventListener('touchend', startAutoScroll, { passive: true });

        startAutoScroll();
      }
    })
    .catch(() => {});
})();

window.openReviewModal = function () {
  const modal = document.getElementById('reviewModal');
  if (modal) modal.style.display = 'flex';
};

window.closeReviewModal = function () {
  const modal = document.getElementById('reviewModal');
  if (modal) modal.style.display = 'none';
};

document.getElementById('reviewForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const name = document.getElementById('reviewName')?.value?.trim();
  const rating = parseInt(document.getElementById('reviewRating')?.value || '5');
  const comment = document.getElementById('reviewComment')?.value?.trim();
  const errDiv = document.getElementById('reviewError');
  const okDiv = document.getElementById('reviewSuccess');
  const btn = document.getElementById('reviewSubmitBtn');

  if (errDiv) errDiv.style.display = 'none';
  if (okDiv) okDiv.style.display = 'none';
  if (!name || !comment) {
    if (errDiv) { errDiv.textContent = 'Please fill in all fields.'; errDiv.style.display = 'block'; }
    return;
  }

  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/store-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_name: name, rating, content: comment })
    });
    if (!res.ok) throw new Error('Failed');
    if (okDiv) okDiv.style.display = 'block';
    this.reset();
    // Reset stars to 5
    document.querySelectorAll('.star-btn').forEach((s, i) => {
      s.classList.toggle('active', i < 5);
    });
    const ratingInput = document.getElementById('reviewRating');
    if (ratingInput) ratingInput.value = '5';
  } catch {
    if (errDiv) { errDiv.textContent = 'Failed to submit. Please try again.'; errDiv.style.display = 'block'; }
  } finally {
    if (btn) btn.disabled = false;
  }
});
