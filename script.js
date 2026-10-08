/* =========================================================
   DEEPAK MEDICAL AGENCY - script.js
   ---------------------------------------------------------
   FILE MAP (upar se neeche):
     1. CONFIG            - saari settings ek jagah
     2. STATE             - global variables
     3. HELPERS           - chhote reusable functions
     4. CART STORAGE      - localStorage (save / load / 24h expiry / sync)
     5. SEARCH & FILTER   - search box + category filter
     6. PRODUCT DISPLAY   - product cards banana
     7. CART ACTIONS      - add / increase / decrease / remove
     8. CART PANEL        - cart ka UI (open / close / render)
     9. ORDER             - WhatsApp + Google Sheet par order bhejna
    10. IMAGE ZOOM        - product image viewer
    11. HEADER SCROLL     - mobile par logo hide/show
    12. INIT              - page load par sab start karna
    13. SLIDER (OPTIONAL) - abhi band hai
========================================================= */


/* =========================================================
   1. CONFIG
   Kuch badalna ho (number, timing, URL) to sirf yahin badlo.
========================================================= */

const CONFIG = {

    // WhatsApp number (country code ke saath, + ke bina)
    WHATSAPP_NUMBER: "917804008789",

    // Order ka backup Google Sheet me jaata hai (Apps Script URL)
    SHEET_URL: "https://script.google.com/macros/s/AKfycbwVDN0OlZ5srpTFPFEIR0O0B43Oe5vcHap70EJcfBtsbXuPLy8QdKMTs8NtwaJ3JRnGxA/exec",
    SHEET_SECRET: "DeepakMedical2026",

    // Order form checks (client side = sirf customer ki madad ke liye, asli check Apps Script me hota hai)
    MIN_ORDER_DELAY_MS: 3000,     // page khulne ke itne ms se pehle order = bot maana jaayega
    MAX_NAME_LENGTH: 50,
    MAX_ADDRESS_LENGTH: 200,

    // Cart itne time baad automatically delete (24 ghante)
    CART_EXPIRY_MS: 24 * 60 * 60 * 1000,

    // Search typing rukne ke itne ms baad chalega
    SEARCH_DELAY_MS: 300,

    // Mobile header: itna continuous scroll (px) hone par logo toggle hoga
    HEADER_TOGGLE_THRESHOLD: 45,
    HEADER_TOP_SAFE_ZONE: 20,     // page ke top par logo hamesha dikhega
    HEADER_LOCK_MS: 250,          // toggle ke baad chhota cooldown
    MOBILE_MAX_WIDTH: 768
};


/* =========================================================
   2. STATE (global variables)
========================================================= */

let products = [];          // products.json ka poora data
let displayOrder = [];      // ek baar shuffle hua order (bestsellers upar)
let currentProducts = [];   // abhi screen par dikh rahe (filtered) products
let cart = [];              // cart items
let cartOpen = false;       // cart panel khula hai ya nahi

const pageLoadTime = Date.now();   // bot detect karne ke liye (order ke time se compare hota hai)


/* =========================================================
   3. HELPERS
========================================================= */

/* Array ko randomly shuffle karta hai (original array ko nahi chhedta) */
function shuffleArray(array){

    const arr = [...array];

    for(let i = arr.length - 1; i > 0; i--){

        const j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]];

    }

    return arr;

}

/* Debounce: jab tak customer type kar raha hai function hold rehta hai.
   Typing rukne ke baad hi chalta hai, isse har key par re-render nahi hota. */
function debounce(func, delay){

    let timer;

    return function(...args){

        clearTimeout(timer);

        timer = setTimeout(() => func.apply(this, args), delay);

    };

}

/* Search ke liye text normalize: "Tea-Tree / Oil" -> "teatreeoil" */
function normalizeText(text){

    return String(text ?? "")
        .toLowerCase()
        .replace(/[\s+\-\/;(),.*]+/g, "");

}

/* Mobile number saaf karo: sirf digits rakho, +91 / 91 / 0 hata do.
   "+91 98765-43210" -> "9876543210" */
function normalizeMobile(raw){

    let digits = String(raw ?? "").replace(/\D/g, "");

    if(digits.length === 12 && digits.startsWith("91")){
        digits = digits.slice(2);
    }else if(digits.length === 11 && digits.startsWith("0")){
        digits = digits.slice(1);
    }

    return digits;

}

/* HTML me text/attribute daalne se pehle special characters safe karta hai.
   (Agar kisi product naam me " ya < aaye to layout nahi tootega) */
function escapeHTML(value){

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}

/* Product ki saari images ki list.
   Naye products: product.images = ["a.jpg", "b.jpg"]
   Purane products: product.image = "a.jpg"   */
function getProductImages(product){

    if(Array.isArray(product.images) && product.images.length > 0){
        return product.images;
    }

    return product.image ? [product.image] : [];

}

/* Product ki pehli (main) image */
function getMainImage(product){

    return getProductImages(product)[0] || "";

}


/* =========================================================
   4. CART STORAGE (localStorage)
========================================================= */

/* Cart ko browser se load karo, 24 ghante se purana ho to delete */
function loadCart(){

    cart = JSON.parse(localStorage.getItem("cart")) || [];

    const savedTime = Number(localStorage.getItem("cartTime"));

    if(savedTime && (Date.now() - savedTime > CONFIG.CART_EXPIRY_MS)){

        clearCartStorage();

        cart = [];

    }

}

/* Cart + time save karo (time se 24h expiry check hoti hai) */
function saveCart(){

    localStorage.setItem("cart", JSON.stringify(cart));

    localStorage.setItem("cartTime", Date.now());

}

function clearCartStorage(){

    localStorage.removeItem("cart");

    localStorage.removeItem("cartTime");

}

/* Cart ko products.json se sync karo.
   Kyun? Cart me purana naam/price/image save rehta hai. Agar image rename
   ho gayi ya price badal gaya ya product hata diya gaya, to cart purana dikhata.
   Isse cart hamesha latest data dikhata hai. */
function syncCartWithProducts(){

    cart = cart

        // Jo product ab JSON me nahi hai, use cart se hatao
        .filter(item => products.some(p => p.id === item.id))

        // Baaki items ka latest data lo
        .map(item => {

            const p = products.find(prod => prod.id === item.id);

            return {
                ...item,
                name: p.name,
                packing: p.packing,
                price: p.price,
                image: getMainImage(p)
            };

        });

    // Sirf cart update karo (cartTime nahi, warna 24h expiry badh jaayegi)
    localStorage.setItem("cart", JSON.stringify(cart));

}


/* =========================================================
   5. SEARCH & FILTER
========================================================= */

/* Kya product search se match karta hai?
   Har word product ke name / company / salt / uses me kahin bhi hona chahiye.
   Example: "paracetamol fever" -> wahi products jinme dono words ho. */
function matchesSearch(product, rawSearch){

    // Search khaali hai -> sab dikhao
    if(rawSearch.trim() === ""){
        return true;
    }

    const searchableText = normalizeText(
        product.name + " " +
        product.company + " " +
        product.saltContent + " " +
        product.uses
    );

    const words = rawSearch
        .toLowerCase()
        .split(/\s+/)
        .map(normalizeText)
        .filter(w => w !== "");

    return words.every(word => searchableText.includes(word));

}

/* Category buttons me se sahi wale ko "active" karo */
function setActiveCategoryButton(category){

    document.querySelectorAll(".cat-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.category === category);
    });

}

/* Search + category dono lagakar products dikhao.
   displayOrder me sirf .filter() hota hai (naya shuffle nahi),
   isliye order stable rehta hai aur bestsellers upar hi rehte hain. */
function filterProducts(){

    const rawSearch = document.getElementById("search").value;

    const category = document.getElementById("categoryFilter").value;

    currentProducts = displayOrder.filter(product =>
        (category === "ALL" || product.category === category) &&
        matchesSearch(product, rawSearch)
    );

    displayProducts(currentProducts);

    setActiveCategoryButton(category);

}

/* Category button click par (dropdown ko bhi sync rakhta hai) */
function selectCategory(category){

    document.getElementById("categoryFilter").value = category;

    filterProducts();

}


/* =========================================================
   6. PRODUCT DISPLAY
   Har product ka card banata hai:
   - Left: image (+ stock badge + multiple image badge)
   - Right: naam, pack, company, MRP
   - Neeche: Add to Cart / Quantity box / Out of Stock
========================================================= */

function displayProducts(items){

    let html = "";

    items.forEach(product => {

        // Cart me kitni quantity hai
        const cartItem = cart.find(item => item.id === product.id);
        const qty = cartItem ? cartItem.qty : 0;

        // Images
        const productImages = getProductImages(product);
        const mainImage = getMainImage(product);

        // Stock: inStock === false hi "Out of Stock" hai.
        // Field missing ho to "In Stock" maana jaata hai (purane entries na toote).
        const isInStock = product.inStock !== false;

        const stockBadge = isInStock
            ? `<div class="stock-badge in-stock"><span class="stock-dot"></span>In Stock</div>`
            : `<div class="stock-badge out-of-stock"><span class="stock-dot"></span>Out of Stock</div>`;

        // Camera badge sirf tab jab 1 se zyada images ho
        const imageBadge = productImages.length > 1
            ? `<div class="multiple-image-badge">📷 ${productImages.length}</div>`
            : "";

        // Neeche wala button / quantity box
        let actionHTML;

        if(!isInStock){

            actionHTML = `
                <button class="out-of-stock-btn" disabled>Out of Stock</button>`;

        }else if(qty === 0){

            actionHTML = `
                <button onclick="addToCart(${product.id})">Add to Cart</button>`;

        }else{

            actionHTML = `
                <div class="qty-box">
                    <div class="qty-btn minus" onclick="decreaseQtyById(${product.id})">&minus;</div>
                    <div class="qty-value">${qty}</div>
                    <div class="qty-btn plus" onclick="increaseQtyById(${product.id})">&plus;</div>
                </div>`;

        }

        html += `
        <div class="card">

            <!-- LEFT: image -->
            <div class="product-left">
                <div class="product-image">
                    ${stockBadge}
                    <img
                        src="${escapeHTML(mainImage)}"
                        alt="${escapeHTML(product.name)}"
                        class="zoomable-image"
                        data-id="${escapeHTML(product.id)}">
                    ${imageBadge}
                </div>
            </div>

            <!-- RIGHT: details -->
            <div class="product-right">

                <div class="product-title">
                    <h3>${escapeHTML(product.name)}</h3>
                </div>

                <div class="product-meta">
                    <div class="info-row">

                        <div class="info-left">
                            <p class="packing">Pack : ${escapeHTML(product.packing)}</p>
                            <p class="company">Mfg/Mkt : ${escapeHTML(product.company)}</p>
                        </div>

                        <div class="info-right">
                            <span class="mrp-text">MRP</span>
                            <span class="mrp-price">₹${escapeHTML(product.price)}</span>
                        </div>

                    </div>
                </div>

                ${actionHTML}

            </div>

        </div>`;

    });

    document.getElementById("products").innerHTML = html;

}


/* =========================================================
   7. CART ACTIONS
   Do tarah ke functions hain:
   - ...ById(id)   : product list ke buttons ke liye
   - ...(index)    : cart panel ke buttons ke liye
========================================================= */

/* Cart badalne ke baad: save + cart panel + product cards sab refresh */
function refreshUI(){

    saveCart();

    showCart();

    displayProducts(currentProducts);

}

function addToCart(id){

    const product = products.find(p => p.id === id);

    if(!product) return;

    const item = cart.find(x => x.id === id);

    if(item){

        item.qty++;

    }else{

        cart.push({
            id: product.id,
            name: product.name,
            packing: product.packing,
            image: getMainImage(product),
            price: product.price,
            qty: 1
        });

    }

    refreshUI();

}

function increaseQtyById(id){

    const item = cart.find(x => x.id === id);

    if(item){

        item.qty++;

        refreshUI();

    }

}

function decreaseQtyById(id){

    const index = cart.findIndex(x => x.id === id);

    if(index !== -1){

        decreaseQty(index);

    }

}

function increaseQty(index){

    cart[index].qty++;

    refreshUI();

}

function decreaseQty(index){

    if(cart[index].qty > 1){

        cart[index].qty--;

    }else{

        cart.splice(index, 1);   // qty 1 thi aur minus dabaya -> item hata do

    }

    refreshUI();

}

function removeItem(index){

    cart.splice(index, 1);

    refreshUI();

}


/* =========================================================
   8. CART PANEL (side se aane wala cart)
========================================================= */

/* Cart ka HTML banata hai aur header ke Cart button ka count update karta hai */
function showCart(){

    const cartButton = document.getElementById("cartButton");

    const cartArea = document.getElementById("cartArea");

    // Customer ne jo type kiya hai use yaad rakho, warna qty badalte hi form khaali ho jaata tha
    const typed = {
        name:    document.getElementById("customerName")?.value    || "",
        mobile:  document.getElementById("customerMobile")?.value  || "",
        address: document.getElementById("customerAddress")?.value || ""
    };

    // ---------- Cart khaali ----------
    if(cart.length === 0){

        closeCart();

        // Slide-out animation khatam hone ke baad content hatao
        setTimeout(() => { cartArea.innerHTML = ""; }, 350);

        cartButton.innerHTML = "🛒 Cart (0)";

        return;
    }

    // ---------- Cart me items ----------
    let total = 0;
    let totalItems = 0;

    let html = `
    <div class="cart-header">
        <h2>🛒 Cart</h2>
        <button class="close-btn" onclick="closeCart()">Close</button>
    </div>`;

    cart.forEach((item, index) => {

        total += item.price * item.qty;
        totalItems += item.qty;

        html += `
        <div class="cart-item">
            <div class="cart-row">

                <img src="${escapeHTML(item.image)}" class="cart-img" alt="${escapeHTML(item.name)}">

                <div class="cart-details">

                    <div class="cart-item-top">
                        <span class="cart-name">${escapeHTML(item.name)}</span>
                        <span class="cart-price">₹${escapeHTML(item.price)}</span>
                    </div>

                    <div class="cart-pack">(${escapeHTML(item.packing)})</div>

                    <div class="cart-action">

                        <div class="cart-qty-box">
                            <div class="qty-btn minus" onclick="decreaseQty(${index})">&minus;</div>
                            <div class="qty-value">${item.qty}</div>
                            <div class="qty-btn plus" onclick="increaseQty(${index})">&plus;</div>
                        </div>

                        <button class="remove-btn" onclick="removeItem(${index})">&times;</button>

                    </div>

                </div>

            </div>
        </div>`;

    });

    html += `
    <h3 class="total">Total ₹${total.toFixed(2)}</h3>

    <input id="customerName" placeholder="Customer Name"
           autocomplete="name" maxlength="${CONFIG.MAX_NAME_LENGTH}">

    <input id="customerMobile" placeholder="Mobile Number"
           type="tel" inputmode="numeric" autocomplete="tel" maxlength="14">

    <input id="customerAddress" placeholder="Address"
           autocomplete="street-address" maxlength="${CONFIG.MAX_ADDRESS_LENGTH}">

    <!-- HONEYPOT: insaan ko ye dikhta nahi. Bots har field bhar dete hain, isse pakde jaate hain. -->
    <div class="hp-wrap" aria-hidden="true">
        <input id="companyWebsite" type="text" tabindex="-1" autocomplete="off">
    </div>

    <br><br>

    <button class="order-btn" onclick="sendOrder()">Order on WhatsApp</button>`;

    cartArea.innerHTML = html;

    // Typed values wapas daalo
    document.getElementById("customerName").value    = typed.name;
    document.getElementById("customerMobile").value  = typed.mobile;
    document.getElementById("customerAddress").value = typed.address;

    cartButton.innerHTML = `🛒 Cart (${totalItems})`;

}

/* Cart button par click: panel kholo ya band karo */
function toggleCart(){

    if(cart.length === 0) return;

    const cartArea = document.getElementById("cartArea");

    cartArea.style.transform = cartOpen ? "translateX(100%)" : "translateX(0)";

    cartOpen = !cartOpen;

}

function closeCart(){

    document.getElementById("cartArea").style.transform = "translateX(100%)";

    cartOpen = false;

}


/* =========================================================
   9. ORDER (WhatsApp + Google Sheet)
========================================================= */

/* Ek cart item ki line (WhatsApp message aur Sheet dono me use hoti hai) */
function formatOrderLine(item){

    return `🔹 ${item.name} (${item.packing})\n` +
           `   Qty : ${item.qty} | Amount : ₹${(item.price * item.qty).toFixed(2)}\n\n`;

}

function sendOrder(){

    if(cart.length === 0){

        alert("Cart is empty!");

        return;
    }

    const name = document.getElementById("customerName").value.trim();
    const mobile = normalizeMobile(document.getElementById("customerMobile").value);
    const address = document.getElementById("customerAddress").value.trim();
    const honeypot = document.getElementById("companyWebsite").value;

    // ---------- Bot check ----------
    // Honeypot bhara hua hai to ye bot hai: chup-chaap ruk jao (koi alert nahi)
    if(honeypot !== ""){
        return;
    }

    // ---------- Validation (customer ki madad ke liye; asli check Apps Script me bhi hai) ----------
    if(name.length < 2){

        alert("Please enter Customer Name");

        return;
    }

    // India ka mobile: 6-9 se shuru, total 10 digits
    if(!/^[6-9]\d{9}$/.test(mobile)){

        alert("Please enter a valid 10 digit Mobile Number");

        return;
    }

    // ---------- Order ka text banao ----------
    let total = 0;
    let productList = "";

    cart.forEach(item => {

        total += item.price * item.qty;

        productList += formatOrderLine(item);

    });

    const message =
`Hello Deepak Medical Agency

Customer Name: ${name}

Mobile Number: ${mobile}

Address: ${address}

Order Details:

${productList}━━━━━━━━━━━━━━

Total Products : ${cart.length}

Total Amount : ₹${total.toFixed(2)}`;

    // ---------- 1) Google Sheet me backup (fail ho to bhi order nahi rukega) ----------
    fetch(CONFIG.SHEET_URL, {

        method: "POST",

        mode: "no-cors",

        body: JSON.stringify({
            secret: CONFIG.SHEET_SECRET,
            hp: honeypot,                          // honeypot (hamesha khaali hona chahiye)
            elapsed: Date.now() - pageLoadTime,    // page khulne ke baad kitne ms me order aaya
            name: name,
            mobile: mobile,
            address: address,
            products: productList,
            total: total.toFixed(2)
        })

    }).catch(error => {

        console.error("Order log to Sheet failed:", error);

    });

    // ---------- 2) WhatsApp kholo ----------
    window.open(
        `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=` + encodeURIComponent(message)
    );

    // ---------- 3) Cart saaf ----------
    cart = [];

    clearCartStorage();

    showCart();

    closeCart();

    displayProducts(currentProducts);   // product cards me "Add to Cart" wapas aa jaaye

}


/* =========================================================
   10. IMAGE ZOOM (Amazon style viewer)
   - Left me chhote thumbnails, right me ek badi image
   - Thumbnail click -> badi image badalti hai
   - Bahar (dark area) click / tap ya ESC -> band
========================================================= */

function openImageZoom(images){

    // Single image (string) ya multiple (array) dono chalte hain
    if(!Array.isArray(images)){
        images = [images];
    }

    // ---------- Overlay banao ----------
    const overlay = document.createElement("div");

    overlay.className = "image-zoom-overlay";

    overlay.innerHTML = `
        <div class="zoom-viewer">

            <!-- Left: thumbnails -->
            <div class="zoom-sidebar">
                ${images.map((image, index) => `
                    <div class="zoom-sidebar-thumb ${index === 0 ? "active" : ""}"
                         data-image="${escapeHTML(image)}">
                        <img src="${escapeHTML(image)}" alt="Product image ${index + 1}">
                    </div>
                `).join("")}
            </div>

            <!-- Right: badi image -->
            <div class="zoom-main-image">
                <img src="${escapeHTML(images[0])}" class="zoomed-image" alt="Product Image">
            </div>

        </div>`;

    document.body.appendChild(overlay);

    // Fade-in animation
    requestAnimationFrame(() => overlay.classList.add("active"));

    const mainImage = overlay.querySelector(".zoomed-image");

    const thumbnails = overlay.querySelectorAll(".zoom-sidebar-thumb");

    // ---------- Thumbnail click: sirf badi image badalti hai ----------
    thumbnails.forEach(thumbnail => {

        thumbnail.addEventListener("click", function(event){

            event.stopPropagation();

            mainImage.src = this.dataset.image;

            thumbnails.forEach(item => item.classList.remove("active"));

            this.classList.add("active");

        });

    });

    // ---------- Bahar click / tap: band ----------
    // Badi image ya thumbnail par click ho to band NAHI hoga
    overlay.addEventListener("click", function(event){

        if(event.target.closest(".zoomed-image") ||
           event.target.closest(".zoom-sidebar-thumb")){
            return;
        }

        closeImageZoom(overlay);

    });

}

function closeImageZoom(overlay){

    overlay.classList.remove("active");   // fade-out animation

    // CSS animation khatam hone ke baad hata do
    setTimeout(() => {

        if(overlay && overlay.parentNode){
            overlay.parentNode.removeChild(overlay);
        }

    }, 250);

}


/* =========================================================
   11. MOBILE HEADER - SCROLL DOWN par sirf LOGO hide
   ---------------------------------------------------------
   Amazon/Flipkart jaisa: neeche scroll karo -> logo + tagline chhup jaata hai.
   Search bar aur category buttons hamesha dikhte hain.
   Upar scroll karo -> logo wapas.

   Tareeka simple rakha hai: header par "logo-hidden" class lagti/hatti hai,
   aur CSS (style.css) logo ko hide karta hai.
   Cart button header ke andar (.search-cart me) hai, uski position CSS se tay hoti hai.
========================================================= */

const siteHeader = document.querySelector("header");

let lastScrollY = window.scrollY;
let ticking = false;            // scroll events ko frame ke hisaab se limit karne ke liye
let accumulatedDelta = 0;       // ek hi direction me ab tak kitna scroll hua
let lastDirection = null;       // "down" | "up" | null
let isLocked = false;           // toggle ke turant baad cooldown (jitter se bachne ke liye)

function isMobileView(){

    return window.innerWidth <= CONFIG.MOBILE_MAX_WIDTH;

}

function setLogoHidden(hidden){

    if(siteHeader.classList.contains("logo-hidden") === hidden) return;

    siteHeader.classList.toggle("logo-hidden", hidden);

    // Chhota cooldown: touch-scroll ke bounce se turant dobara toggle na ho
    isLocked = true;

    setTimeout(() => { isLocked = false; }, CONFIG.HEADER_LOCK_MS);

}

function resetScrollTracking(){

    accumulatedDelta = 0;
    lastDirection = null;

}

function updateHeaderState(){

    ticking = false;

    // Desktop par logo hamesha dikhta hai
    if(!isMobileView()){
        setLogoHidden(false);
        lastScrollY = window.scrollY;
        resetScrollTracking();
        return;
    }

    const scrollY = window.scrollY;
    const diff = scrollY - lastScrollY;
    lastScrollY = scrollY;

    // Page ke bilkul top par logo hamesha dikhao
    if(scrollY <= CONFIG.HEADER_TOP_SAFE_ZONE){
        setLogoHidden(false);
        resetScrollTracking();
        return;
    }

    if(isLocked || diff === 0) return;

    const direction = diff > 0 ? "down" : "up";

    // Direction badli (jitter) -> counter reset
    if(direction !== lastDirection){
        accumulatedDelta = 0;
        lastDirection = direction;
    }

    accumulatedDelta += Math.abs(diff);

    // Kaafi continuous scroll hua tabhi toggle
    if(accumulatedDelta >= CONFIG.HEADER_TOGGLE_THRESHOLD){

        setLogoHidden(direction === "down");

        accumulatedDelta = 0;

    }

}


/* =========================================================
   12. INIT - page load par yahin se sab shuru hota hai
========================================================= */

/* products.json aane ke baad: order banao, cart sync karo, screen par dikhao */
function initProducts(data){

    products = data;

    // Bestsellers pehle (shuffle), phir baaki (shuffle). Ek hi baar shuffle hota hai.
    const bestSellers = shuffleArray(products.filter(p => p.bestseller));

    const otherProducts = shuffleArray(products.filter(p => !p.bestseller));

    displayOrder = [...bestSellers, ...otherProducts];

    currentProducts = displayOrder;

    syncCartWithProducts();

    displayProducts(currentProducts);

    showCart();

}

/* Saare event listeners yahin lagte hain (HTML me inline onclick kam se kam) */
function setupEventListeners(){

    // Search: "input" event (keyup nahi), taaki paste / mobile keyboard bhi pakde jaaye
    document.getElementById("search")
        .addEventListener("input", debounce(filterProducts, CONFIG.SEARCH_DELAY_MS));

    // Dropdown category
    document.getElementById("categoryFilter")
        .addEventListener("change", filterProducts);

    // Category buttons (HTML me data-category="TABLET_CAP" jaise attribute hain)
    document.querySelectorAll(".cat-btn").forEach(btn => {
        btn.addEventListener("click", () => selectCategory(btn.dataset.category));
    });

    // Cart button
    document.getElementById("cartButton")
        .addEventListener("click", toggleCart);

    // Product image click -> zoom viewer (ek hi listener poore products area par)
    document.getElementById("products").addEventListener("click", event => {

        const img = event.target.closest(".zoomable-image");

        if(!img) return;

        const product = products.find(p => String(p.id) === img.dataset.id);

        if(product){
            openImageZoom(getProductImages(product));
        }

    });

    // ESC dabane par zoom band
    document.addEventListener("keydown", event => {

        if(event.key !== "Escape") return;

        const overlay = document.querySelector(".image-zoom-overlay");

        if(overlay){
            closeImageZoom(overlay);
        }

    });

    // Mobile header scroll
    window.addEventListener("scroll", () => {

        if(!ticking){
            window.requestAnimationFrame(updateHeaderState);
            ticking = true;
        }

    }, { passive: true });

    window.addEventListener("resize", () => {

        if(!isMobileView()) setLogoHidden(false);

    });

}

/* ---------- START ---------- */

loadCart();

setupEventListeners();

fetch("products.json")
    .then(response => {

        if(!response.ok) throw new Error("HTTP " + response.status);

        return response.json();

    })
    .then(initProducts)
    .catch(error => {

        // Fetch fail ya JSON galat ho to customer ko blank screen ki jagah message dikhe.
        // Asli error developer ke liye console me hai.
        console.error("Products load failed:", error);

        document.getElementById("products").innerHTML =
            `<p style="padding:20px;text-align:center;color:#666;">
                ⚠️ Products load nahi ho paaye. Please page refresh karein.
            </p>`;

    });


/* =========================================================
   13. SLIDER (OPTIONAL - abhi band hai)
   Chalu karna ho to:
     1) index.html me slider ka HTML uncomment karo
     2) niche ka code uncomment karo
     3) style.css me .slider / .slides ka CSS check karo
========================================================= */

/*
let currentSlide = 0;

const slides = document.querySelector(".slides");

const slideImages = document.querySelectorAll(".slides img");

const totalSlides = slideImages.length;

function updateSlider(){

    slides.style.transform = `translateX(-${currentSlide * 100}%)`;

}

function nextSlide(){

    currentSlide = (currentSlide + 1) % totalSlides;

    updateSlider();

}

function prevSlide(){

    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;

    updateSlider();

}

document.querySelector(".next").addEventListener("click", nextSlide);

document.querySelector(".prev").addEventListener("click", prevSlide);

setInterval(nextSlide, 4000);
*/
