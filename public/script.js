let allProducts = []; // Store all products for search
let currentCategory = 'all'; // For category filtering

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
    const img = escapeHtml((p.images && p.images[0]) || '/uploads/default.jpg');
    const stockClass = p.stock === 'out of stock' ? 'out-of-stock' : '';

    return `
      <a href="/product/${p.id}" class="product-card-link">
        <div class="product-card">
          <img src="${img}" alt="${name}">
          <h3>${name}</h3>
          <p>${size}</p>
          <p class="price">₹${price} (Approx – confirm on WhatsApp)</p>
          <p class="stock ${stockClass}">${stock}</p>
        </div>
      </a>
    `;
  }).join('');
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
          <div class="main-image-container">
            ${images.length > 1 ? '<button class="gallery-btn" id="prevImage">‹</button>' : ''}
            <img id="mainImage" src="${escapeHtml(images[0] || '/uploads/default.jpg')}" alt="${escapeHtml(String(product.name || ''))}">

            ${images.length > 1 ? '<button class="gallery-btn" id="nextImage">›</button>' : ''}

          </div>
            ${images.length > 1 ? `<div class="gallery-thumbs">${images.map((img, idx) => `<img src="${escapeHtml(img)}" onclick="changeImage(${idx})" class="${idx === 0 ? 'active' : ''}" alt="Thumbnail ${idx + 1}">`).join('')}</div>` : ''}


        </div>
        <div class="detail-info">
          <h1>${escapeHtml(product.name || '')}</h1>
          <p><strong>Size:</strong> ${escapeHtml(product.size || '')}</p>
          <p class="price"><strong>Price:</strong> ₹${escapeHtml(product.price || '')} (Approx – confirm on WhatsApp)</p>
          <p class="stock ${stockLabel === 'out of stock' ? 'out-of-stock' : ''}"><strong>Stock:</strong> ${escapeHtml(stockLabel)}</p>
          <p>${escapeHtml(product.description || '')}</p>


          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="addToOrder('${product.id}', '${escapeHtml((product.name || '').replace(/'/g, "\\'"))}', '${escapeHtml(product.size)}', '${escapeHtml(product.price)}', '${escapeHtml(images[0] || '')}')" class="btn btn-secondary" ${stockLabel === 'out of stock' ? 'disabled' : ''} style="flex: 1; cursor: pointer; font-weight: 600;">Add to Cart</button>
            <a href="https://wa.me/919407114022?text=${encodeURIComponent("Hi, I'm interested in " + (product.name || "") + " (" + (product.size || "") + ")!")}" class="btn btn-primary" ${stockLabel === 'out of stock' ? 'style="pointer-events: none; opacity: 0.5; flex: 1;"' : 'style="flex: 1;"'}>Buy Now</a>
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
  document.getElementById('mainImage').src = images[idx];
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
  const filtered = allProducts.filter(p => 
    (currentCategory === 'all' || p.category === currentCategory) &&
    p.name.toLowerCase().includes(query)
  );
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

// Search bar
document.getElementById('searchBar')?.addEventListener('input', filterProducts);

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
    document.getElementById('loginForm').style.display = 'none';
    loadAdminProducts();
  } catch (err) {
    console.error('Login error:', err);
    if (errorDiv) { errorDiv.style.display = 'block'; errorDiv.innerText = 'Failed to connect to server. Please try again.'; }
  }
});

// Toggle password visibility
window.togglePassword = function() {
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
window.logoutAdmin = function() {
  sessionStorage.removeItem('adminToken');
  window.location.reload();
};


// Load products in admin
async function loadAdminProducts() {
  try {
  // Read-only is public, but keep auth header for future-proofing
  const adminToken = sessionStorage.getItem('adminToken');
  const response = await fetch('/api/products', {
    headers: adminToken ? { 'x-admin-token': adminToken } : undefined
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const products = await response.json();

  const container = document.getElementById('productsList');
  container.innerHTML = products.map(p => {
    const name = escapeHtml(p.name || '');
    const size = escapeHtml(p.size || '');
    const price = escapeHtml(p.price || '');
    const description = escapeHtml(p.description || '');
    const category = escapeHtml(p.category || '');
    const images = Array.isArray(p.images) ? p.images : [];

    return `
      <div class="admin-product-row">
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
          <small class="helper-text">Visibility on public site.</small>
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
        
        <div style="grid-column: 1 / -1;">
          <textarea id="description-${p.id}" placeholder="Description">${description}</textarea>
          <small class="helper-text">Description</small>
        </div>
        
        <div id="images-${p.id}" class="images-list">${images.map((img, idx) => {
          const safeImg = escapeHtml(img || '');
          return `<div><input type="text" value="${safeImg}" id="img-${p.id}-${idx}"><button onclick="removeImage(${p.id}, ${idx})">Remove</button></div>`;
        }).join('')}</div>
        
        <div style="grid-column: 1 / -1;">
          <input type="file" id="upload-${p.id}" accept="image/*" multiple>
          <small class="helper-text">Select images</small>
        </div>
        
        <button onclick="uploadImage(${p.id})">Upload Images</button>
        <button onclick="addImage(${p.id})">Add URL</button>
        <button class="btn" onclick="updateProduct(${p.id})">Update</button>
        <button class="btn" onclick="deleteProduct(${p.id})" style="background-color: #FF6B6B;">Delete</button>
      </div>
    `;
  }).join('');

  } catch (err) {
    console.error('Failed to load admin products:', err);
    alert('Failed to load products. Please try again.');
  }
}

// Update product
async function updateProduct(id) {
  try {
    const name = document.getElementById(`name-${id}`).value;
    const size = document.getElementById(`size-${id}`).value;
    const price = document.getElementById(`price-${id}`).value;
    const stock = document.getElementById(`stock-${id}`).value;
    const visibility = document.getElementById(`visibility-${id}`).checked;
    const category = document.getElementById(`category-${id}`).value;
    const description = document.getElementById(`description-${id}`).value;
    const images = Array.from(document.querySelectorAll(`#images-${id} input`)).map(input => input.value);
    const adminToken = sessionStorage.getItem('adminToken');
    const response = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { 'x-admin-token': adminToken } : {})
      },
      body: JSON.stringify({ name, size, price, stock, visibility, category, description, images })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    loadAdminProducts();
    if (window.location.pathname === '/products') loadProducts('allProducts');
  } catch (err) {
    console.error('Failed to update product:', err);
    alert('Failed to update product. Please try again.');
  }
}

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
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => newInput.remove());
        newInput.appendChild(input);
        newInput.appendChild(removeBtn);
        imagesDiv.appendChild(newInput);
      });
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

  // Avoid innerHTML to reduce accidental HTML injection + Enter-key weirdness
  const input = document.createElement('input');
  input.type = 'text';
  input.value = url;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Remove';
  btn.style.marginLeft = '8px';
  btn.addEventListener('click', () => {
    // Remove the correct element (no relying on index that can shift)
    newInput.remove();
  });

  newInput.appendChild(input);
  newInput.appendChild(btn);
  imagesDiv.appendChild(newInput);
}

function removeImage(id, idx) {
  // Legacy function kept for compatibility with older inline onclick usage.
  const imagesDiv = document.getElementById(`images-${id}`);
  if (imagesDiv && imagesDiv.children[idx]) imagesDiv.removeChild(imagesDiv.children[idx]);
}

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
      <div><label>Name</label><input type="text" id="add-name" class="form-control" style="width:100%;padding:10px;"/></div>
      <div><label>Size</label><input type="text" id="add-size" class="form-control" style="width:100%;padding:10px;"/></div>
      <div><label>Price</label><input type="text" id="add-price" class="form-control" style="width:100%;padding:10px;"/></div>
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
      <div style="grid-column: 1 / -1;">
        <label>Description</label>
        <textarea id="add-description" style="width:100%;padding:10px;min-height:90px;"></textarea>
      </div>
      <div style="grid-column: 1 / -1;">
        <label><input type="checkbox" id="add-visibility" checked /> Visible on public site</label>
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
  window.addImageUrlRow = function() {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '10px';
    wrap.style.alignItems = 'center';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'https://.../image.webp';
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
    const description = document.getElementById('add-description').value;
    const visibility = document.getElementById('add-visibility').checked;

    const imageInputs = Array.from(document.querySelectorAll('#add-images input[type="text"]'));
    const images = imageInputs.map(i => i.value.trim()).filter(Boolean);

    if (!name || !size || !price || !stock || !category || images.length === 0) {
      alert('Please fill all required fields and add at least 1 image URL.');
      return;
    }

    const adminToken = sessionStorage.getItem('adminToken');
    await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { 'x-admin-token': adminToken } : {})
      },
      body: JSON.stringify({ name, size, price, stock, visibility, category, description, images })
    });

    close();
    loadAdminProducts();
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
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAdminProducts();
  }
}

// ============================================
// MOBILE NAVBAR TOGGLE
// ============================================
(function() {
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
(function() {
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

  searchInput.addEventListener('input', (e) => {
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
  
  // Generate a random ID if none exists
  const newId = 'guest_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  document.cookie = `guest_id=${newId}; path=/; max-age=31536000`; // 1 year expiry
  return newId;
}

// Get guest ID on load
const guestId = getGuestId();
let cartItems = [];

// Fetch cart from database
async function fetchCart() {
  try {
    const res = await fetch('/api/cart', { headers: { 'x-guest-id': guestId } });
    cartItems = await res.json();
    updateOrderUI();
  } catch (err) {
    console.error('Failed to fetch cart', err);
  }
}

// Add product to order
window.addToOrder = async function(productId, name, size, price, image = null) {
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-guest-id': guestId },
      body: JSON.stringify({ productId, name, size, price, image })
    });
    cartItems = await res.json();
    updateOrderUI();
    showOrderNotification(`${name} added to cart!`);
  } catch (err) {
    console.error('Failed to add to cart', err);
    alert('Failed to add item to cart');
  }
};

window.updateQuantity = async function(productId, quantity) {
  if (quantity < 1) return;
  try {
    const res = await fetch(`/api/cart/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-guest-id': guestId },
      body: JSON.stringify({ quantity })
    });
    cartItems = await res.json();
    updateOrderUI();
    renderOrderItems();
  } catch (err) {
    console.error('Failed to update quantity', err);
  }
};

// Remove item from order
window.removeFromOrder = async function(productId) {
  try {
    const res = await fetch(`/api/cart/${productId}`, {
      method: 'DELETE',
      headers: { 'x-guest-id': guestId }
    });
    cartItems = await res.json();
    updateOrderUI();
    renderOrderItems();
  } catch (err) {
    console.error('Failed to remove item', err);
  }
};

// Clear entire order
window.clearOrder = async function() {
  try {
    await fetch('/api/cart', {
      method: 'DELETE',
      headers: { 'x-guest-id': guestId }
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

window.showOrderModal = function() {
  let modal = document.getElementById('orderModal');
  if (modal) {
    modal.style.display = 'flex';
    renderOrderItems();
  }
};

window.closeOrderModal = function() {
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
window.sendToWhatsApp = function() {
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
  const whatsappNumber = '919407114022';
  const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
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
  
  // 1. Float Button
  const floatBtn = document.createElement('div');
  floatBtn.id = 'orderFloat';
  floatBtn.className = 'order-float';
  floatBtn.style.display = 'none'; // Hidden by default
  floatBtn.innerHTML = `
    <button class="order-btn" id="viewOrderBtn">
      🛒 View Cart (<span id="orderCount" class="order-count">0</span>)
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