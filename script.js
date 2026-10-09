/* =========================================================
   DEEPAK MEDICAL AGENCY - script.js
   ---------------------------------------------------------
   FILE MAP (upar se neeche):
     1. CONFIG            - saari settings ek jagah
     2. STATE             - global variables
     3. HELPERS           - chhote reusable functions
     4. CART STORAGE      - localStorage (save / load / 24h expiry / sync)
     5. SEARCH & FILTER   - search box + category filter
     6. PRODUCT DISPLAY   - product cards, lazy loading, infinite scroll, Not Found
     7. CART ACTIONS      - add / increase / decrease / remove
     8. CART PAGE         - cart ki alag page-view (open / back / render)
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
    SHEET_URL: "https://script.google.com/macros/s/AKfycbwyaIhDC1lovVSVVEcTbjFi0BcLOJ9GgphwzuLKWxnJlkDcdUHlaf_ITYrMxwT_HsTuow/exec",
    SHEET_SECRET: "DeepakMedical2026",

    // Order form checks (client side = sirf customer ki madad ke liye, asli check Apps Script me hota hai)
    MIN_ORDER_DELAY_MS: 3000,     // page khulne ke itne ms se pehle order = bot maana jaayega
    MAX_NAME_LENGTH: 50,
    MAX_ADDRESS_LENGTH: 200,

    // Cart itne time baad automatically delete (24 ghante)
    CART_EXPIRY_MS: 24 * 60 * 60 * 1000,

    // Infinite scroll: ek baar me itne products dikhte hain
    PAGE_SIZE: 24,
    // Neeche pahunchne par spinner itni der ghumta hai, phir agle products aate hain
    LOAD_MORE_DELAY_MS: 700,

    // Quantity: ek item ki max qty (typing me isse zyada daalne par yahi ban jaati hai)
    MAX_QTY: 9999,

    // "Item Added" message kitni der dikhe (style.css ke .added-toast animation se same rakho)
    ADDED_FLASH_MS: 1200,

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

// Infinite scroll state (section 6)
let visibleCount = 0;               // abhi screen par kitne products dikh rahe hain
let isLoadingMore = false;          // agla batch aane me hai
let loadToken = 0;                  // filter badalne par badhta hai (purana timer cancel karne ke liye)
let suppressLoadUntil = 0;          // is time tak naya batch load nahi hoga (Contact Us scroll ke liye)
let loadMoreObserver = null;

// Cart page ka navigation state (section 8)
let savedScrollY = 0;       // cart kholne se pehle products page kahan tak scroll tha
let cartPushed = false;     // cart hamne khola (browser history me entry bani) ya seedha #cart link se aaye
let leavingCart = false;    // back chal raha hai, dobara close mat karo

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

/* Pehle batch me kitne products. Purane browser (IntersectionObserver nahi) me sab ek saath. */
function firstPageSize(){

    return ("IntersectionObserver" in window) ? CONFIG.PAGE_SIZE : Number.MAX_SAFE_INTEGER;

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
/* Search box aur category ke hisaab se products ki filtered list */
function computeFilteredProducts(){

    const rawSearch = document.getElementById("search").value;

    const category = document.getElementById("categoryFilter").value;

    return displayOrder.filter(product =>
        (category === "ALL" || product.category === category) &&
        matchesSearch(product, rawSearch)
    );

}

function filterProducts(){

    const category = document.getElementById("categoryFilter").value;

    currentProducts = computeFilteredProducts();

    // Naya search / category: phir se pehle 24 products se shuru
    visibleCount = firstPageSize();
    loadToken++;
    isLoadingMore = false;

    renderProductList();

    // Neeche scroll kiya hua tha to list ke upar le jao
    if(window.scrollY > 0){
        window.scrollTo({ top: 0 });
    }

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

/* Ek product ka card (HTML string). index = list me position (pehle 4 images turant load hoti hain) */
function buildProductCard(product, index = 99){

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
                <input class="qty-input" type="text" inputmode="numeric" pattern="[0-9]*"
                       maxlength="4" value="${qty}" data-id="${escapeHTML(product.id)}"
                       aria-label="Quantity">
                <div class="qty-btn plus" onclick="increaseQtyById(${product.id})">&plus;</div>
            </div>`;

    }

    // Lazy loading: screen ke bahar wali images tab load hongi jab user paas pahunche.
    // Sabse upar ke 4 products turant load hote hain (page jaldi dikhe).
    const loadingAttrs = index < 4
        ? 'loading="eager"'
        : 'loading="lazy" decoding="async"';

    // Product page ka link (products.json me "url" hota hai, build_product_pages.py jodta hai).
    // url ho to image aur naam dono us page par le jaate hain; na ho to purana zoom chalta hai.
    const imgTag = `<img
                        src="${escapeHTML(mainImage)}"
                        alt="${escapeHTML(product.name)}"
                        ${product.url ? "" : 'class="zoomable-image"'}
                        ${loadingAttrs}
                        data-id="${escapeHTML(product.id)}">`;

    const imageHTML = product.url
        ? `<a class="product-link" href="${escapeHTML(product.url)}" aria-label="${escapeHTML(product.name)} - details">${imgTag}</a>`
        : imgTag;

    const titleHTML = product.url
        ? `<a href="${escapeHTML(product.url)}">${escapeHTML(product.name)}</a>`
        : escapeHTML(product.name);

    return `
    <div class="card" data-id="${escapeHTML(product.id)}">

            <!-- LEFT: image -->
            <div class="product-left">
                <div class="product-image">
                    ${stockBadge}
                    ${imageHTML}
                    ${imageBadge}
                </div>
            </div>

            <!-- RIGHT: details -->
            <div class="product-right">

                <div class="product-title">
                    <h3>${titleHTML}</h3>
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

        </div>
    `.trim();

}

/* Not Found: search ka kuch nahi mila -> hara WhatsApp button, click par chat khulti hai */
function buildNotFoundHTML(){

    const term = document.getElementById("search").value.trim().slice(0, 80);

    const text = term
        ? `Hello Deepak Medical Agency, mujhe "${term}" chahiye. Kya ye available hai?`
        : "Hello Deepak Medical Agency, mujhe ek dawa chahiye jo website par nahi mili.";

    const link = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=` + encodeURIComponent(text);

    return `
    <div class="not-found">

        ${term ? `<p class="not-found-term">&ldquo;${escapeHTML(term)}&rdquo; ke liye koi product nahi mila</p>` : ""}

        <a class="not-found-btn" href="${link}" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">💬</span>
            <span>Not Found ! Chat on WhatsApp</span>
        </a>

    </div>`;

}

/* currentProducts me se pehle "visibleCount" products screen par dikhao */
function renderProductList(){

    const productsEl = document.getElementById("products");

    if(currentProducts.length === 0){

        productsEl.innerHTML = buildNotFoundHTML();

    }else{

        productsEl.innerHTML = currentProducts
            .slice(0, visibleCount)
            .map((product, index) => buildProductCard(product, index))
            .join("");

    }

    updateLoadMore();

}

/* Cart badalne par sirf wahi ek card badlo (poori list dobara nahi banti: tez + images flicker nahi).
   - Qty sirf badli (1 -> 5): card ko chhedte nahi, bas number badalte hain
     (taaki typing, keyboard aur +/- click beech me na toote)
   - "Add to Cart" <-> qty box badalna ho to card dobara banta hai */
function updateCard(id, flash = false){

    const product = products.find(p => p.id === id);

    const card = document.querySelector(`#products .card[data-id="${id}"]`);

    if(!product || !card) return;

    const cartItem = cart.find(item => item.id === id);

    const qty = cartItem ? cartItem.qty : 0;

    const qtyInput = card.querySelector(".qty-input");

    if(qtyInput && qty > 0){

        qtyInput.value = qty;

        return;

    }

    card.outerHTML = buildProductCard(product);

    if(flash){
        showAddedFlash(id);
    }

}

/* Card ke upar thodi der "Item Added" dikhao (desktop + mobile dono par) */
function showAddedFlash(id){

    const card = document.querySelector(`#products .card[data-id="${id}"]`);

    if(!card) return;

    card.querySelector(".added-toast")?.remove();    // pehle wala ho to hata do

    const toast = document.createElement("div");

    toast.className = "added-toast";

    toast.setAttribute("role", "status");

    toast.textContent = "✔ Item Added";

    card.appendChild(toast);

    setTimeout(() => toast.remove(), CONFIG.ADDED_FLASH_MS + 100);

}


/* ---------- INFINITE SCROLL ----------
   Pehle 24 products. User list ke neeche pahunche to spinner ~0.7 sec ghumta hai,
   phir agle 24 aate hain (Amazon jaisa). Search / category badalne par phir 24 se shuru.
   Spinner (#loadMore) list ke neeche hai; IntersectionObserver dekhta hai ki wo screen par aaya ya nahi. */

/* Spinner tabhi dikhao jab aur products baaki hon */
function updateLoadMore(){

    const loadMoreEl = document.getElementById("loadMore");

    const hasMore = currentProducts.length > visibleCount;

    loadMoreEl.classList.toggle("active", hasMore);

    // Dobara observe: agar spinner abhi bhi screen par hai to agla batch bhi chalu ho jaaye
    if(hasMore && loadMoreObserver){

        loadMoreObserver.unobserve(loadMoreEl);

        loadMoreObserver.observe(loadMoreEl);

    }

}

function onLoadMoreVisible(entries){

    if(entries[0].isIntersecting){
        loadMoreProducts();
    }

}

function loadMoreProducts(){

    if(isLoadingMore) return;
    if(visibleCount >= currentProducts.length) return;
    if(Date.now() < suppressLoadUntil) return;

    isLoadingMore = true;

    const token = loadToken;

    // Thoda ruko (spinner dikhe), phir agle products jodo
    setTimeout(() => {

        // Is beech search / category badal gaya to ye purana batch chhod do
        if(token !== loadToken) return;

        const start = visibleCount;

        visibleCount += CONFIG.PAGE_SIZE;

        const nextCards = currentProducts
            .slice(start, visibleCount)
            .map(product => buildProductCard(product))
            .join("");

        // Purane cards ko chhedte nahi, sirf neeche jodte hain (scroll jump nahi hota)
        document.getElementById("products").insertAdjacentHTML("beforeend", nextCards);

        isLoadingMore = false;

        updateLoadMore();

    }, CONFIG.LOAD_MORE_DELAY_MS);

}


/* =========================================================
   7. CART ACTIONS
   Do tarah ke functions hain:
   - ...ById(id)   : product list ke buttons ke liye
   - ...(index)    : cart panel ke buttons ke liye
========================================================= */

/* Cart badalne ke baad: save + cart page refresh.
   changedId diya ho to sirf wahi product card badalta hai, nahi diya to poori list (jaise Clear cart). */
function refreshUI(changedId, flash = false){

    saveCart();

    // Cart page me sirf qty badli ho to poora cart dobara nahi banta (typing / focus na toote).
    // Item judne ya hatne par poora cart dobara banta hai.
    if(!tryLightCartUpdate()){
        showCart();
    }

    if(changedId === undefined){
        renderProductList();
    }else{
        updateCard(changedId, flash);
    }

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

    refreshUI(id, true);     // true = card par "Item Added" dikhao

}

function increaseQtyById(id){

    const item = cart.find(x => x.id === id);

    if(item){

        item.qty++;

        refreshUI(id);

    }

}

function decreaseQtyById(id){

    const index = cart.findIndex(x => x.id === id);

    if(index !== -1){

        decreaseQty(index);

    }

}

function increaseQty(index){

    const id = cart[index].id;

    cart[index].qty++;

    refreshUI(id);

}

function decreaseQty(index){

    const id = cart[index].id;

    if(cart[index].qty > 1){

        cart[index].qty--;

    }else{

        cart.splice(index, 1);   // qty 1 thi aur minus dabaya -> item hata do

    }

    refreshUI(id);

}

/* Customer ne qty box me khud number type kiya (change event se chalta hai).
   - 0 type kiya  -> item cart se hat jaata hai
   - khaali chhoda -> purani qty wapas
   - bahut bada number -> MAX_QTY tak */
function applyTypedQty(input){

    // data-id string hota hai, product ki asli id (number) wapas nikalo
    const product = products.find(p => String(p.id) === input.dataset.id);

    if(!product) return;

    const id = product.id;

    const current = cart.find(x => x.id === id)?.qty ?? 0;

    const digits = input.value.replace(/\D/g, "");

    if(digits === ""){
        input.value = current;
        return;
    }

    const qty = Math.min(parseInt(digits, 10), CONFIG.MAX_QTY);

    if(qty === current){
        input.value = current;      // jaise "007" -> "7"
        return;
    }

    setQty(id, qty);

}

function setQty(id, qty){

    const index = cart.findIndex(x => x.id === id);

    if(index === -1) return;        // qty box sirf cart me maujood item par hota hai

    if(qty <= 0){
        cart.splice(index, 1);
    }else{
        cart[index].qty = qty;
    }

    refreshUI(id);

}

function removeItem(index){

    const id = cart[index].id;

    cart.splice(index, 1);

    refreshUI(id);

}


/* =========================================================
   8. CART PAGE
   ---------------------------------------------------------
   Cart ab side se slide nahi hota. Cart button dabane par
   products ki jagah poora CART PAGE dikhta hai (wholesale ke liye:
   saare products ek saath dikhte hain).

   Kaise kaam karta hai:
   - Cart kholne par URL me "#cart" lagta hai (browser history me ek entry)
   - Phone / browser ka BACK button dabane par products page wapas aata hai
   - "Back to Products" button bhi wahi karta hai
   - Wapas aane par products page usi jagah scroll hota hai jahan tha
   - style.css me body par "cart-view" class lagti hai aur wahi
     products chhupa kar cart dikhati hai
========================================================= */

function isCartRoute(){

    return location.hash === "#cart";

}

/* Cart page kholo (header ke Cart button se) */
function openCart(){

    if(cart.length === 0 || isCartRoute()) return;

    savedScrollY = window.scrollY;     // products page ki jagah yaad rakho

    cartPushed = true;

    location.hash = "cart";            // hashchange -> renderView() chalega

}

/* Cart page band karo, products page par wapas */
function closeCart(){

    if(!isCartRoute() || leavingCart) return;

    leavingCart = true;

    if(cartPushed){

        cartPushed = false;

        history.back();                // hashchange -> renderView()

    }else{

        // Seedha /#cart link se aaye the (history me peeche site se bahar jaata),
        // isliye bas "#cart" hata do
        history.replaceState(null, "", location.pathname + location.search);

        renderView();

    }

}

/* URL ke hisaab se sahi page dikhao (cart ya products).
   Ye hashchange par, aur products load hone ke baad chalta hai. */
function renderView(){

    leavingCart = false;

    // Khaali cart ke saath #cart par aaye: wapas products
    if(isCartRoute() && cart.length === 0){

        history.replaceState(null, "", location.pathname + location.search);

    }

    const showCartView = isCartRoute() && cart.length > 0;

    const wasCartView = document.body.classList.contains("cart-view");

    document.body.classList.toggle("cart-view", showCartView);

    if(showCartView && !wasCartView){

        showCart();

        window.scrollTo(0, 0);

    }

    if(!showCartView){

        cartPushed = false;

        if(wasCartView){
            window.scrollTo(0, savedScrollY);   // products wahin jahan chhode the
        }

    }

}

/* Cart ka total amount aur total qty */
function getCartTotals(){

    let total = 0;
    let totalItems = 0;

    cart.forEach(item => {
        total += item.price * item.qty;
        totalItems += item.qty;
    });

    return { total, totalItems };

}

/* Cart page ke upar wala count, total aur header ka Cart button update (poora cart dobara banaye bina) */
function updateCartSummary(){

    const { total, totalItems } = getCartTotals();

    const countEl = document.querySelector("#cartArea .cart-count");
    const totalEl = document.querySelector("#cartArea .total");

    if(countEl) countEl.textContent = `(${cart.length} products, ${totalItems} qty)`;
    if(totalEl) totalEl.textContent = `Total ₹${total.toFixed(2)}`;

    document.getElementById("cartButton").innerHTML = `🛒 Cart (${totalItems})`;

}

/* Cart page me sirf qty badli ho (items wahi ke wahi) to bas numbers badlo.
   true = ho gaya, false = structure badla (item juda/hata) -> poora cart dobara banao */
function tryLightCartUpdate(){

    if(cart.length === 0) return false;

    const rows = document.querySelectorAll("#cartArea .cart-item");

    if(rows.length !== cart.length) return false;

    for(let i = 0; i < rows.length; i++){
        if(rows[i].dataset.id !== String(cart[i].id)) return false;
    }

    rows.forEach((row, i) => {
        row.querySelector(".qty-input").value = cart[i].qty;
    });

    updateCartSummary();

    return true;

}

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

        cartArea.innerHTML = "";

        cartButton.innerHTML = "🛒 Cart (0)";

        closeCart();    // cart page par the to products par wapas (warna kuch nahi hota)

        return;
    }

    // ---------- Cart me items ----------
    const { total, totalItems } = getCartTotals();

    let itemsHTML = "";

    cart.forEach((item, index) => {

        itemsHTML += `
        <div class="cart-item" data-id="${escapeHTML(item.id)}">
            <div class="cart-row">

                <img src="${escapeHTML(item.image)}" class="cart-img" alt="${escapeHTML(item.name)}" loading="lazy" decoding="async">

                <div class="cart-details">

                    <div class="cart-item-top">
                        <span class="cart-name">${escapeHTML(item.name)}</span>
                        <span class="cart-price">₹${escapeHTML(item.price)}</span>
                    </div>

                    <div class="cart-pack">(${escapeHTML(item.packing)})</div>

                    <div class="cart-action">

                        <div class="cart-qty-box">
                            <div class="qty-btn minus" onclick="decreaseQty(${index})">&minus;</div>
                            <input class="qty-input" type="text" inputmode="numeric" pattern="[0-9]*"
                                   maxlength="4" value="${item.qty}" data-id="${escapeHTML(item.id)}"
                                   aria-label="Quantity">
                            <div class="qty-btn plus" onclick="increaseQty(${index})">&plus;</div>
                        </div>

                        <button class="remove-btn" onclick="removeItem(${index})">&times;</button>

                    </div>

                </div>

            </div>
        </div>`;

    });

    cartArea.innerHTML = `

    <!-- Upar: back button + title + clear -->
    <div class="cart-header">

        <button class="back-btn" onclick="closeCart()">← Back to Products</button>

        <h2>🛒 Cart <span class="cart-count">(${cart.length} products, ${totalItems} qty)</span></h2>

        <button class="clear-btn" onclick="clearCart()">Clear cart</button>

    </div>

    <div class="cart-layout">

        <!-- Left: saare products ki list -->
        <div class="cart-items">
            ${itemsHTML}
        </div>

        <!-- Right (mobile par neeche): total + customer form + order button -->
        <div class="cart-summary">

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

            <button class="order-btn" onclick="sendOrder()">Order on WhatsApp</button>

        </div>

    </div>`;

    // Typed values wapas daalo
    document.getElementById("customerName").value    = typed.name;
    document.getElementById("customerMobile").value  = typed.mobile;
    document.getElementById("customerAddress").value = typed.address;

    cartButton.innerHTML = `🛒 Cart (${totalItems})`;

}

/* Saare products cart se hatao (confirm ke baad) */
function clearCart(){

    if(!confirm("Cart ke saare products hata dein?")) return;

    cart = [];

    refreshUI();

}


/* =========================================================
   9. ORDER (WhatsApp + Google Sheet)
========================================================= */

/* Ek cart item ki line (WhatsApp message aur Sheet dono me use hoti hai) */
function formatOrderLine(item){

    return `🔹 ${item.name} (${item.packing})\n` +
           `   Qty : ${item.qty} | Amount : ₹${(item.price * item.qty).toFixed(2)}\n\n`;

}

/* Order ID banao: DMA-YYMMDD-XXXX   (jaise DMA-261009-K7QX)
   - YYMMDD = aaj ki date (India time), isse Sheet me date se sort karna aasan
   - XXXX   = 4 random akshar/number (0, O, 1, I jaise confusing akshar nahi)
   Ye WhatsApp message aur Google Sheet dono me jaata hai, taaki customer aur aap ek hi ID se order dhundh sako. */
function generateOrderId(){

    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        year: "2-digit",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const get = type => parts.find(p => p.type === type).value;

    const datePart = get("year") + get("month") + get("day");

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const random = new Uint8Array(4);

    crypto.getRandomValues(random);

    const suffix = Array.from(random, n => chars[n % chars.length]).join("");

    return `DMA-${datePart}-${suffix}`;

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

    const orderId = generateOrderId();

    const message =
`Hello Deepak Medical Agency

Order ID: ${orderId}

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
            orderId: orderId,
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

    showCart();     // cart khaali hai, to ye khud products page par wapas bhej deta hai

    renderProductList();   // product cards me "Add to Cart" wapas aa jaaye

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

/* ---------- URL se search / category (product page ka search box /?q=... aur breadcrumb /?cat=... se aata hai) ---------- */
function applyUrlParams(){

    const params = new URLSearchParams(location.search);

    const q = params.get("q");

    const cat = params.get("cat");

    if(q){
        document.getElementById("search").value = q.slice(0, 80);
    }

    const select = document.getElementById("categoryFilter");

    if(cat && [...select.options].some(option => option.value === cat)){
        select.value = cat;
    }

}


/* ---------- List ki halat yaad rakhna (product page se wapas aane ke liye) ----------
   Customer product kholta hai aur BACK dabata hai: use wahi list, wahi scroll, wahi search milni chahiye.
   Order bhi save hota hai kyunki list random shuffle hoti hai. */
const LIST_STATE_KEY = "dmaListState";

function saveListState(){

    // Cart page par ho to list ki halat save mat karo
    if(isCartRoute() || displayOrder.length === 0) return;

    try{

        sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify({
            y: window.scrollY,
            count: visibleCount,
            q: document.getElementById("search").value,
            cat: document.getElementById("categoryFilter").value,
            order: displayOrder.map(p => p.id)
        }));

    }catch(error){

        // Private mode me sessionStorage band ho sakta hai, koi baat nahi

    }

}

/* true = list wapas set ho gayi */
function restoreListState(){

    try{

        const nav = performance.getEntriesByType("navigation")[0];

        if(!nav || nav.type !== "back_forward") return false;

        const saved = JSON.parse(sessionStorage.getItem(LIST_STATE_KEY));

        if(!saved || !Array.isArray(saved.order)) return false;

        // Purana order wapas (naye products, agar aaye hon, end me)
        const byId = new Map(products.map(p => [String(p.id), p]));

        const ordered = saved.order.map(id => byId.get(String(id))).filter(Boolean);

        const inOrder = new Set(ordered.map(p => p.id));

        displayOrder = [...ordered, ...products.filter(p => !inOrder.has(p.id))];

        document.getElementById("search").value = saved.q || "";

        document.getElementById("categoryFilter").value = saved.cat || "ALL";

        currentProducts = computeFilteredProducts();

        visibleCount = Math.max(saved.count || 0, firstPageSize());

        setActiveCategoryButton(document.getElementById("categoryFilter").value);

        // Cards bante hi scroll wahan le jao
        requestAnimationFrame(() => window.scrollTo({ top: saved.y || 0, behavior: "instant" }));

        return true;

    }catch(error){

        return false;

    }

}


/* products.json aane ke baad: order banao, cart sync karo, screen par dikhao */
function initProducts(data){

    products = data;

    // Bestsellers pehle (shuffle), phir baaki (shuffle). Ek hi baar shuffle hota hai.
    const bestSellers = shuffleArray(products.filter(p => p.bestseller));

    const otherProducts = shuffleArray(products.filter(p => !p.bestseller));

    displayOrder = [...bestSellers, ...otherProducts];

    syncCartWithProducts();

    // Product page se BACK karke aaye ho to list wahin, usi order me, usi scroll par
    // (warna random order badal jaata aur customer phir upar se shuru karta). Nahi to URL ke ?q= / ?cat= dekho.
    if(!restoreListState()){

        applyUrlParams();

        currentProducts = computeFilteredProducts();

        visibleCount = firstPageSize();

        setActiveCategoryButton(document.getElementById("categoryFilter").value);

    }

    renderProductList();

    showCart();

    renderView();    // URL "#cart" ho (refresh par) to cart page dikhao

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

    // Infinite scroll: spinner (#loadMore) screen par aate hi agle products load
    if("IntersectionObserver" in window){

        loadMoreObserver = new IntersectionObserver(onLoadMoreVisible, { rootMargin: "0px 0px 100px 0px" });

        loadMoreObserver.observe(document.getElementById("loadMore"));

    }

    // "Contact Us" se footer tak scroll ho raha ho to beech me naye products load mat karo
    // (warna footer neeche khisak jaata hai aur user wahan pahunch nahi paata)
    document.querySelector(".contact-btn")?.addEventListener("click", () => {
        suppressLoadUntil = Date.now() + 2000;
    });

    // Quantity box me type karna (product card + cart page dono). Ek hi listener sab ke liye.
    document.addEventListener("change", event => {
        if(event.target.matches(".qty-input")) applyTypedQty(event.target);
    });

    document.addEventListener("input", event => {
        // Sirf digits (0-9) chalenge
        if(event.target.matches(".qty-input")){
            event.target.value = event.target.value.replace(/\D/g, "");
        }
    });

    document.addEventListener("focusin", event => {
        // Click karte hi poora number select: seedha naya number type karo
        if(event.target.matches(".qty-input")){
            setTimeout(() => event.target.select(), 0);
        }
    });

    document.addEventListener("keydown", event => {
        // Enter dabane par qty set + keyboard band
        if(event.key === "Enter" && event.target.matches(".qty-input")){
            event.target.blur();
        }
    });

    // Product page par jaate waqt list ki halat yaad rakho
    window.addEventListener("pagehide", saveListState);

    // Browser ne poora page cache se wapas diya (back button): cart product page par badla ho sakta hai
    window.addEventListener("pageshow", event => {

        if(!event.persisted) return;

        loadCart();

        syncCartWithProducts();

        renderProductList();

        showCart();

    });

    // Cart button -> cart page
    document.getElementById("cartButton")
        .addEventListener("click", openCart);

    // Browser / phone ka BACK button (URL "#cart" badalta hai) -> sahi page dikhao
    window.addEventListener("hashchange", renderView);

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
