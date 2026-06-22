let allProducts = []; // Store all products for search
let currentCategory = 'all'; // For category filtering

// Load and display products on public pages
async function loadProducts(containerId, filterVisible = true) {
  const response = await fetch('/api/products');
  const products = await response.json();
  allProducts = filterVisible ? products.filter(p => p.visibility) : products;
  filterProducts(); // Apply initial filter
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
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function renderProducts(containerId, products) {
  const container = document.getElementById(containerId);
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
  const response = await fetch('/api/products');
  const products = await response.json();
  const product = products.find(p => p.id == id);
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
          <h1>${String(product.name || '')}</h1>
          <p><strong>Size:</strong> ${String(product.size || '')}</p>
          <p class="price"><strong>Price:</strong> ₹${String(product.price || '')} (Approx – confirm on WhatsApp)</p>
          <p class="stock ${stockLabel === 'out of stock' ? 'out-of-stock' : ''}"><strong>Stock:</strong> ${String(stockLabel)}</p>
          <p>${escapeHtml(product.description || '')}</p>


          <a href="https://wa.me/9407114022?text=Hi, I'm interested in ${String(product.name || '')} (${String(product.size || '')})!" class="btn" ${stockLabel === 'out of stock' ? 'style="pointer-events: none; opacity: 0.5;"' : ''}>Contact on WhatsApp</a>


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
  const token = document.getElementById('password').value;
  if (!token) return alert('Enter admin token');

 // Clear any existing session before validating new token
  sessionStorage.removeItem('adminToken');
  document.getElementById('adminPanel').style.display = 'none';

  // Use a protected route to validate the token
  const response = await fetch('/api/auth', {
    headers: { 'x-admin-token': token }
  });

  if (response.status === 401) {
    alert('Invalid admin token');
    return;
  }

  sessionStorage.setItem('adminToken', token);
  document.getElementById('adminPanel').style.display = 'block';
  loadAdminProducts();
});


// Load products in admin
async function loadAdminProducts() {
  // Read-only is public, but keep auth header for future-proofing
  const adminToken = sessionStorage.getItem('adminToken');
  const response = await fetch('/api/products', {
    headers: adminToken ? { 'x-admin-token': adminToken } : undefined
  });
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

}

// Update product
async function updateProduct(id) {
  const name = document.getElementById(`name-${id}`).value;
  const size = document.getElementById(`size-${id}`).value;
  const price = document.getElementById(`price-${id}`).value;
  const stock = document.getElementById(`stock-${id}`).value;
  const visibility = document.getElementById(`visibility-${id}`).checked;
  const category = document.getElementById(`category-${id}`).value;
  const description = document.getElementById(`description-${id}`).value;
  const images = Array.from(document.querySelectorAll(`#images-${id} input`)).map(input => input.value);
  const adminToken = sessionStorage.getItem('adminToken');
  await fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { 'x-admin-token': adminToken } : {})
    },
    body: JSON.stringify({ name, size, price, stock, visibility, category, description, images })
  });

  loadAdminProducts();
  if (window.location.pathname === '/products') loadProducts('allProducts');
}

// Delete product
async function deleteProduct(id) {
  const adminToken = sessionStorage.getItem('adminToken');
  await fetch(`/api/products/${id}`, {
    method: 'DELETE',
    headers: adminToken ? { 'x-admin-token': adminToken } : undefined
  });

  loadAdminProducts();
  if (window.location.pathname === '/products') loadProducts('allProducts');
}

// Image management
async function uploadImage(id) {
  const fileInput = document.getElementById(`upload-${id}`);
  if (!fileInput.files || fileInput.files.length === 0) return alert('Select files first');
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

  const data = await response.json();
  if (data.urls) {
    const imagesDiv = document.getElementById(`images-${id}`);
    data.urls.forEach(url => {
      const newInput = document.createElement('div');
      newInput.innerHTML = `<input type="text" value="${url}"><button onclick="removeImage(${id}, ${imagesDiv.children.length})">Remove</button>`;
      imagesDiv.appendChild(newInput);
    });
  } else {
    alert('Upload failed');
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

  if (!searchToggle || !searchOverlay) return;

  function openSearch() {
    searchOverlay.classList.add('active');
    setTimeout(() => searchInput?.focus(), 50);
  }

  function closeSearch() {
    searchOverlay.classList.remove('active');
  }

  searchToggle.addEventListener('click', openSearch);
  searchClose?.addEventListener('click', closeSearch);

  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch();
      return;
    }
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (window.location.pathname === '/products') {
        // Already on products page - just fill the search bar
        const productsSearchBar = document.getElementById('searchBar');
        if (productsSearchBar) {
          productsSearchBar.value = query;
          productsSearchBar.dispatchEvent(new Event('input'));
        }
        closeSearch();
      } else {
        // Redirect to products page with query param
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
      // Small delay to ensure loadProducts() has run
      setTimeout(fillSearch, 300);
    }
  }
}

// MULTI-PRODUCT WHATSAPP ORDER SYSTEM


// Initialize order from localStorage
// let orderItems = JSON.parse(localStorage.getItem('orderItems')) || [];

// // Add product to order
// function addToOrder(id, name, size, price) {
//   // Check if already in order
//   const exists = orderItems.find(item => item.id === id);
//   if (exists) {
//     alert('This item is already in your order!');
//     return;
//   }
  
//   // Add to order
//   orderItems.push({ id, name, size, price });
//   localStorage.setItem('orderItems', JSON.stringify(orderItems));
  
//   // Update UI
//   updateOrderUI();
  
//   // Show confirmation
//   showOrderNotification(`${name} added to order`);
// }

// // Remove item from order
// function removeFromOrder(id) {
//   orderItems = orderItems.filter(item => item.id !== id);
//   localStorage.setItem('orderItems', JSON.stringify(orderItems));
//   updateOrderUI();
//   renderOrderItems();
// }

// // Clear entire order
// function clearOrder() {
//   if (confirm('Clear all items from your order?')) {
//     orderItems = [];
//     localStorage.removeItem('orderItems');
//     updateOrderUI();
//     renderOrderItems();
//   }
// }

// // Update floating button and count
// function updateOrderUI() {
//   const floatBtn = document.getElementById('orderFloat');
//   const countEl = document.getElementById('orderCount');
  
//   if (orderItems.length > 0) {
//     floatBtn.style.display = 'block';
//     countEl.textContent = orderItems.length;
//   } else {
//     floatBtn.style.display = 'none';
//     closeOrderModal();
//   }
// }

// // Show order modal
// function showOrderModal() {
//   document.getElementById('orderModal').style.display = 'flex';
//   renderOrderItems();
// }

// // Close order modal
// function closeOrderModal() {
//   document.getElementById('orderModal').style.display = 'none';
// }

// // Render items in modal
// function renderOrderItems() {
//   const container = document.getElementById('orderItemsList');
  
//   if (orderItems.length === 0) {
//     container.innerHTML = '<p class="empty-order">No items in your order yet.</p>';
//     return;
//   }
  
//   container.innerHTML = orderItems.map(item => `
//     <div class="order-item">
//       <div class="order-item-info">
//         <strong>${item.name}</strong>
//         <span>${item.size}</span>
//         <span class="order-item-price">₹${item.price}</span>
//       </div>
//       <button onclick="removeFromOrder(${item.id})" class="remove-item-btn">&times;</button>
//     </div>
//   `).join('');
// }

// // Send order to WhatsApp
// function sendToWhatsApp() {
//   if (orderItems.length === 0) {
//     alert('Your order is empty!');
//     return;
//   }
  
//   // Generate message
//   let message = 'Hi, I want to order:\n';
//   orderItems.forEach((item, index) => {
//     message += `${index + 1}. ${item.name} (${item.size})\n`;
//   });
//   message += '\nPlease confirm price and availability.';
  
//   // WhatsApp number (change this to your actual number)
//   const whatsappNumber = '1234567890';
  
//   // Open WhatsApp
//   const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
//   window.open(url, '_blank');
// }

// // Show notification toast
// function showOrderNotification(message) {
//   const notification = document.createElement('div');
//   notification.className = 'order-notification';
//   notification.textContent = message;
//   document.body.appendChild(notification);
  
//   setTimeout(() => notification.classList.add('show'), 100);
//   setTimeout(() => {
//     notification.classList.remove('show');
//     setTimeout(() => notification.remove(), 300);
//   }, 2000);
// }

// // Event listener for floating button
// document.getElementById('viewOrderBtn')?.addEventListener('click', showOrderModal);

// // Initialize on page load
// if (window.location.pathname === '/products') {
//   updateOrderUI();
// }

// // Close modal on outside click
// document.getElementById('orderModal')?.addEventListener('click', function(e) {
//   if (e.target.id === 'orderModal') {
//     closeOrderModal();
//   }
// });