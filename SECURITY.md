# Security & Threat Model

This document outlines the security architecture and threat model for the Perfume Store MVP application. It serves to document our accepted risks and the specific defense-in-depth measures implemented.

## 1. Authentication & Session Management
- **Stateless Admin Authentication:** The application uses JSON Web Tokens (JWT) for authentication. Tokens are stored locally in the browser and transmitted via a custom `x-admin-token` HTTP header instead of cookies.
  - **Why:** This architectural choice entirely mitigates Cross-Site Request Forgery (CSRF). Browsers do not automatically attach local storage tokens or custom headers to cross-origin requests.
  - **Future Upgrade (V2):** Migrate to HttpOnly cookies coupled with strict SameSite attributes and an explicit CSRF token pattern to mitigate Cross-Site Scripting (XSS) token theft.

- **Guest Sessions:** Anonymous users are assigned a `guest_id` via a non-HttpOnly cookie. This cookie is read by JavaScript to manage their cart state before login.
  - **Risk Acceptance:** While non-HttpOnly cookies can be accessed via XSS, `guest_id` is never elevated to authenticated privileges. It is only used to migrate cart items upon registration.

## 2. Input Validation & Data Integrity
- **Content Security Policy (CSP):** The backend serves a `Content-Security-Policy` header restricting inline scripts and external assets to explicitly trusted domains (e.g., `unpkg.com` and `fonts.googleapis.com`), severely limiting XSS vectors.
- **SQL Guardrails:** The PostgreSQL database utilizes strict `CHECK` constraints (e.g., `stock IN ('in stock', 'out of stock')`) and generated columns (e.g., `price_cents`) to guarantee data normalization at the database level, preventing dirty data from frontend bypasses.
- **Strict Payload Limits:** All JSON API requests are strictly limited to `2mb` by Express to prevent Denial of Service (DoS) attacks via memory exhaustion.

## 3. Storage & Uploads
- **Content-Addressable Images:** Uploaded product images are renamed strictly using their SHA-256 cryptographic hash. This provides immediate Deduplication (O(1)) and eliminates "Time of Check to Time of Use" (TOCTOU) race conditions during concurrent uploads.

## 4. Development Defaults
- **Environment Variables:** The codebase contains fallback hardcoded credentials (e.g., `admin` / `password123`) strictly for local development ease. In production, deployment environments must inject strong secrets via `.env`.

*This MVP is audited and considered robust against high-severity threats. Structural changes requiring significant rewrites are documented and deferred to V2.*
