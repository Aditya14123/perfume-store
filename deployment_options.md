# Perfume Store Website — Deployment & Hosting Proposals

A formal proposal detailing architectural components, hosting specifications, domain requirements, cost breakups, and performance metrics for the Perfume Store website.

---

## 1. Core Architecture Components Explained

To operate an online store, four essential technical components work together:

1. **Domain Name (Website Address):**
   * **What it is:** The official web address customers type into Google or their browser (e.g., `www.yourperfumestore.com`).
   * **Purpose:** Acts as the digital signpost routing visitors directly to the store server.

2. **Server / Web Hosting (24/7 Engine):**
   * **What it is:** A specialized high-speed computer running 24/7/365.
   * **Purpose:** Runs the store application (`server.js`), processes product searches, filters by gender/category, updates carts, and sends pages to customer screens in under 1 second.

3. **Media & SSD Image Storage (Digital Warehouse):**
   * **What it is:** The hard drive space on the server storing perfume photos, prices, descriptions, stock levels, and customer reviews.
   * **Purpose:** Keeps catalog photos and price updates permanently saved. **100% included in the hosting plan at ₹0 extra cost.**

4. **SSL Security Certificate (HTTPS Encryption):**
   * **What it is:** The security padlock icon next to `https://` in the browser address bar.
   * **Purpose:** Encrypts data between customer devices and the server, protecting admin logins and WhatsApp order checkouts.

---

## 2. Hosting Plan Comparison Overview

| Parameter | Plan A: Basic Free Hosting | Plan B: Recommended 24/7 Commercial Plan |
|---|---|---|
| **Target Use Case** | Entry-Level Testing | Production E-Commerce Store |
| **Domain Name (`.com` / `.in`)** | ₹1,000 – ₹1,200 / year | ₹1,000 – ₹1,200 / year |
| **Server Hosting** | ₹0 / month (Free Tier) | ₹200 – ₹350 / month (~₹2,000 – ₹3,800 / year) |
| **Image Storage (10–25GB SSD)** | **Included Free** (Cloud Bucket) | **Included Free** (Server SSD) |
| **SSL Security (HTTPS)** | **Included Free** | **Included Free** |
| **Total Annual Cost** | **₹1,000 – ₹1,200 / year** | **₹3,000 – ₹5,000 / year** |
| **Server Uptime Mode** | Auto-sleeps after 15m inactivity | 24/7 Always Active |
| **Page Load Speed** | 15–20s initialization on inactivity | Instant (< 1 second) |
| **Photo Upload Storage** | Cached Ephemeral Storage | Dedicated SSD Storage |

---

## 3. Detailed Cost Breakup — Plan B (Recommended ₹3,000 – ₹5,000 / Year)

| Item | Description | Cost (INR) | Included Storage & Capacity | Billing Interval |
|---|---|---|---|---|
| **Domain Name Registration** | Custom brand domain (`.com` or `.in`) | ₹1,000 – ₹1,200 | N/A | Billed Annually |
| **24/7 Always-On Hosting** | High-speed dedicated cloud server instance | ₹200 – ₹350 / month | 24/7 Uptime (Zero Sleep Lag) | Monthly / Billed Annually |
| **SSD Image Storage** | Permanent photo uploads directory | **₹0 (Included)** | 10GB–25GB SSD (50,000+ photos) | Included in Hosting |
| **SSL Security Certificate** | 256-bit HTTPS Data Encryption | **₹0 (Included)** | Unlimited Encryption | Included Free |
| **System Backups & Maintenance** | Database persistence & monitoring | **₹0 (Included)** | Automated Backups | Included Free |
| **TOTAL ANNUAL BUDGET** | **Complete 12-Month Store Operation** | **₹3,000 – ₹5,000** | **All-Inclusive Total** | **Annual Budget** |

---

## 4. Technical Performance & Storage Specifications

### Plan A: Basic Free Hosting (₹1,000 – ₹1,200 / Year Total)
* **Architecture:** Shared cloud instance with auto-sleep after 15 minutes of zero traffic.
* **Storage:** Free 25GB Cloud Image Bucket (Cloudinary / Supabase Storage) for lifetime image hosting.
* **Performance:** 15–20 second initialization delay ("cold start") on inactive visits.

### Plan B: Recommended Commercial Plan (₹3,000 – ₹5,000 / Year Total)
* **Architecture:** Dedicated 24/7/365 active cloud instance / VPS. Zero sleep cycles.
* **Storage:** Built-in 10GB–25GB High-Speed SSD Disk Storage for permanent product photo uploads via the Admin Panel. **₹0 separate storage fees.**
* **Performance:** Sub-second page loads (< 1 second) across Indian desktop and mobile networks.
* **Database & File Integrity:** Automated file locking and fallback persistence for product items, reviews, and carts.
