# Perfume Store - Project Roadmap & Status

This document tracks the progress of upgrades to the Perfume Store. It lists both recently completed improvements and planned future enhancements.

## ✅ Completed Changes

**UI & Visual Enhancements (Frontend Only)**
* **AOS Animation Integration:** Added the Animate On Scroll (AOS) library to provide smooth, premium fade-in animations for text and feature cards as the user scrolls.
* **Hero Section Overhaul:** 
  * Replaced the plain background with a premium, high-quality perfume background image.
  * Added a dark translucent overlay to ensure text readability.
  * Upgraded typography to be larger, bolder, and feature elegant drop-shadows.
* **Smooth Scrolling:** Implemented global smooth scrolling behavior for a better navigation experience across the site.
* **Live Search with Previews:** Enhanced the global navigation search bar to show instant dropdown results with product thumbnail images and prices as the user types.

## 🚀 Changes Yet to be Done (Planned Features)

**Backend & Data Persistence (PostgreSQL Required)**
* **Database-Backed Wishlist:** Allow users to save their favorite perfumes. This must be built using the production PostgreSQL database so it persists across devices (strictly avoiding temporary local storage).
* **User Accounts & Authentication:** Implement a secure login system so users can save their wishlists, view order history, and manage their profiles.
* **Admin Dashboard Security:** Add secure authentication to the `/admin` route so only authorized personnel can add, edit, or delete products and manage inventory.

**Advanced UX Features**
* **Advanced Product Filtering:** Add filters allowing users to sort products by **Scent Profile** (Floral, Woody, Citrus, Oud), **Gender**, and **Price Range**.
* **Product Reviews & Ratings:** Add a database schema and UI for users to leave star ratings and reviews on individual perfumes to build trust.

---
*Note: All future features requiring data storage will be built to sync with the live production environment (Render + PostgreSQL), ensuring no data is lost on server restarts.*
