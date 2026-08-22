let cart = JSON.parse(localStorage.getItem("cart")) || [];

let cartOpen = false;

/* saving time stamp of cart to automatically deltion after 24H */ 
const savedTime =
Number(localStorage.getItem("cartTime"));

const ONE_DAY = 24 * 60 * 60 * 1000;

if(savedTime && (Date.now() - savedTime > ONE_DAY)){

    localStorage.removeItem("cart");

    localStorage.removeItem("cartTime");

    cart = [];

}


function shuffleArray(array){

    let arr = [...array];

    for(let i = arr.length - 1; i > 0; i--){

        let j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;

}

/*  Jab tak customer typing continue karta hai, function call hold rehta hai. 
Typing rukne ke 300ms baad hi search chalega — isse har keystroke pe re-render/reshuffle nahi hoga. */

function debounce(func, delay){
    let timer;
    return function(...args){
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

/* To Normalize the text, Original : tea/tree. Normalize : teatree  */
function normalizeText(text){

    return text
        .toLowerCase()
        .replace(/[\s+\-\/;(),.*]+/g,"");

}


/* Helper function to match normalize text value. In future you can also add other keys for search like COMPANY or PACKING.
   Now if you search Paracetamol fever, then its shows all items which contain paracetamol and uses value has fever text. */
function matchesSearch(product, rawSearch){

    // Empty search → show all
    if(rawSearch.trim() === ''){
        return true;
    }

    // Product searchable text
    let searchableText = normalizeText(
        product.name + ' ' +
        product.company + ' ' +
        product.saltContent + ' ' +
        product.uses
    );

    // User words
    let words = rawSearch
        .toLowerCase()
        .split(/\s+/)
        .map(w => normalizeText(w))
        .filter(w => w !== '');

    // Every word must exist
    return words.every(word =>
        searchableText.includes(word)
    );
 }

 /* adding priorty to search text
function getSearchScore(product, rawSearch){

    let score = 0;

    const name = normalizeText(product.name);

    const salt = normalizeText(product.saltContent);

    const uses = normalizeText(product.uses);

    const words = rawSearch
                  .toLowerCase()
                  .split(/\s+/)
                  .map(w => normalizeText(w))
                  .filter(w => w !== "");

    words.forEach(word => {

        word = normalizeText(word);

        if(name.includes(word)){
            score += 100;
        }

        if(salt.includes(word)){
            score += 50;
        }

        if(uses.includes(word)){
            score += 20;
        }

    });

    return score;

}  */

let products = [];
let currentProducts = [];    // currently displayed/filtered products
let displayOrder = [];       // stable shuffled order — sirf ek baar set hota hai

fetch("products.json")
.then(response => response.json())
.then(data => {

 products = data;

 let bestSellers =
 products.filter(product => product.bestseller);

 bestSellers = shuffleArray(bestSellers);

 let otherProducts =
 products.filter(product => !product.bestseller);

 otherProducts = shuffleArray(otherProducts);

 displayOrder = [
    ...bestSellers,
    ...otherProducts
   ];

 currentProducts = displayOrder;

 displayProducts(currentProducts);

 showCart();


    document.getElementById("search")
    .addEventListener("keyup", debounce(filterProducts, 300));

    document.getElementById("categoryFilter")
    .addEventListener("change", filterProducts);

})                                                         /* if fetch fail ho or JSON invalid, customer will see mesage instead of blank screen, */
                                                           /* & error log will be in console(for debugging) */

.catch(error => {

    console.error("Products load failed:", error);

    document.getElementById("products").innerHTML =
        `<p style="padding:20px;text-align:center;color:#666;">
            ⚠️ Products load nahi ho paaye. Please page refresh karein.
        </p>`;

});


/*  Pehle: har search/filter call pe naya shuffleArray() chalta tha → products jump/reorder hote the
Ab: displayOrder (jo load pe ek baar shuffle hui thi) se sirf .filter() kiya jaa raha hai → order stable rehta hai, bestsellers hamesha top pe rehte hain, 
aur search jaldi (koi extra shuffle overhead nahi) chalta hai */

function filterProducts() {

    let rawSearch = document.getElementById('search').value;

    let categoryValue =
    document.getElementById("categoryFilter").value;

    let filtered = displayOrder.filter(product =>
        (categoryValue === "ALL" || product.category === categoryValue) &&
        matchesSearch(product, rawSearch)
    );

 currentProducts = filtered;

 displayProducts(currentProducts);


 // Active category button update

 document.querySelectorAll(".cat-btn")
 .forEach(btn => btn.classList.remove("active"));

 let activeButton = document.querySelector(
 `.cat-btn[onclick*="${categoryValue}"]`
 );

 if(activeButton){

    activeButton.classList.add("active");

 }

 }

function selectCategory(category,button){

    document.getElementById("categoryFilter").value = category;

    filterProducts();

    document.querySelectorAll(".cat-btn")
    .forEach(btn => btn.classList.remove("active"));

    button.classList.add("active");

}
/*=========================================================
  DISPLAY PRODUCTS
  ---------------------------------------------------------
  Purpose:
  - Display all products in product grid
  - Show Add to Cart button if qty = 0
  - Show Quantity selector if product already in cart
=========================================================*/

/*=========================================================
  DISPLAY PRODUCTS
-----------------------------------------------------------
Purpose:
- Display all products on website
- Show Add to Cart button if quantity = 0
- Show Quantity Selector if already added
- Structure optimized for Desktop + Mobile Layout
=========================================================*/

function displayProducts(items){

    let html = "";

    items.forEach(product => {

        // =====================================================
        // CHECK CART QUANTITY
        // =====================================================

        let cartItem = cart.find(item => item.id === product.id);

        let qty = cartItem ? cartItem.qty : 0;


        // =====================================================
        // PRODUCT IMAGE LIST
        //
        // New products:
        // product.images = ["image1.jpg", "image2.jpg"]
        //
        // Old products:
        // product.image = "image.jpg"
        //
        // This keeps old products working normally.
        // =====================================================

        let productImages =
            Array.isArray(product.images) && product.images.length > 0
                ? product.images
                : [product.image];


        // =====================================================
        // MAIN IMAGE
        // First image will be shown on product card.
        // =====================================================

        let mainImage = productImages[0];


        // =====================================================
        // MULTIPLE IMAGE BADGE
        //
        // Badge will ONLY appear when product has more
        // than one image.
        // =====================================================

        let imageBadge = "";

        if(productImages.length > 1){

            imageBadge = `

                <div class="multiple-image-badge">

                    📷 ${productImages.length}

                </div>

            `;

        }


        // =====================================================
        // PRODUCT CARD
        // =====================================================

        html += `

        <div class="card">


            <!-- =================================================
                 LEFT SECTION - PRODUCT IMAGE
            ================================================== -->

            <div class="product-left">

                <div class="product-image">

                    <img
                        src="${mainImage}"
                        alt="${product.name}"
                        class="zoomable-image"
                        onclick='openImageZoom(${JSON.stringify(productImages)})'>


                    <!-- =========================================
                         MULTIPLE IMAGE INDICATOR
                         Only visible when multiple images exist.
                    ========================================== -->

                    ${imageBadge}

                </div>

            </div>


            <!-- =================================================
                 RIGHT SECTION - PRODUCT DETAILS
            ================================================== -->

            <div class="product-right">


                <!-- =============================================
                     PRODUCT NAME
                ============================================== -->

                <div class="product-title">

                    <h3>${product.name}</h3>

                </div>


                <!-- =============================================
                     PRODUCT INFORMATION
                ============================================== -->

                <div class="product-meta">

                    <div class="info-row">


                        <!-- LEFT SIDE
                             Packing + Manufacturer
                        -->

                        <div class="info-left">

                            <p class="packing">

                                Pack : ${product.packing}

                            </p>


                            <p class="company">

                                Mfg/Mkt : ${product.company}

                            </p>

                        </div>


                        <!-- RIGHT SIDE
                             Price + MRP
                        -->

                        <div class="info-right">

                            <span class="mrp-price">

                                ₹ ${product.price}

                            </span>


                            <span class="mrp-text">

                                MRP

                            </span>

                        </div>

                    </div>

                </div>


                <!-- =================================================
                     ADD TO CART / QUANTITY SELECTOR
                ================================================== -->

                ${
                    qty === 0

                    ?

                    `

                    <button
                        onclick="addToCart(${product.id})">

                        Add to Cart

                    </button>

                    `

                    :

                    `

                    <div class="qty-box">


                        <div
                            class="qty-btn minus"
                            onclick="decreaseQtyById(${product.id})">

                            &minus;

                        </div>


                        <div class="qty-value">

                            ${qty}

                        </div>


                        <div
                            class="qty-btn plus"
                            onclick="increaseQtyById(${product.id})">

                            &plus;

                        </div>

                    </div>

                    `

                }

            </div>

        </div>

        `;

    });


    // =========================================================
    // DISPLAY PRODUCTS
    // =========================================================

    document.getElementById("products").innerHTML = html;

}
function addToCart(id){

    const product = products.find(p => p.id === id);

    if(!product) return;

    let item = cart.find(x => x.id === id);

    if(item){

        item.qty++;

    }else{

        cart.push({

            id:product.id,

            name:product.name,

            packing:product.packing,

            image: (Array.isArray(product.images) && product.images.length > 0)   /* firstly it checks image or images[] in  products.json */
                ? product.images[0]                                              
                : product.image,

            price:product.price,

            qty:1

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

    if(index === -1) return;

    if(cart[index].qty > 1){

        cart[index].qty--;

    }else{

        cart.splice(index,1);

    }

    refreshUI();

}


function saveCart(){

    localStorage.setItem("cart", JSON.stringify(cart));

    localStorage.setItem("cartTime", Date.now());

}

function showCart(){

    if(cart.length === 0){

        closeCart();

        setTimeout(() => {
            document.getElementById("cartArea").innerHTML = "";
        },350);

        document.getElementById("cartButton").innerHTML =
        "🛒 Cart (0)";

        document.getElementById("cartButton").onclick =
        toggleCart;

        return;
    }

    let total = 0;

    let html = `

    <div class="cart-header">

        <h2>🛒 Cart</h2>

        <button class="close-btn"
        onclick="closeCart()">
             Close
        </button>

    </div>

    `;

    cart.forEach((item,index)=>{

        total += item.price * item.qty;

        html += `

        <div class="cart-item">

            <div class="cart-row">

                <img
                    src="${item.image}"
                    class="cart-img"
                    alt="${item.name}">

                <div class="cart-details">

                    <div class="cart-item-top">

                        <span class="cart-name">
                            ${item.name}
                        </span>

                        <span class="cart-price">
                            ₹${item.price}
                        </span>

                    </div>

                    <div class="cart-pack">
                        (${item.packing})
                    </div>

                    <div class="cart-action">

                        <div class="cart-qty-box">

                            <div class="qty-btn minus"
                                onclick="decreaseQty(${index})">
                                &minus;
                            </div>

                            <div class="qty-value">
                                ${item.qty}
                            </div>

                            <div class="qty-btn plus"
                                onclick="increaseQty(${index})">
                                &plus;
                            </div>

                        </div>

                        <button class="remove-btn"
                            onclick="removeItem(${index})">
                            &times;
                        </button>

                    </div>

                </div>

            </div>

        </div>

        `;

    });

    html += `

    <h3 class="total">
        Total ₹${total.toFixed(2)}
    </h3>

    <input
    id="customerName"
    placeholder="Customer Name">

    <input
    id="customerMobile"
    placeholder="Mobile Number">

    <input
    id="customerAddress"
    placeholder="Address">

    <br><br>

    <button class="order-btn"
        onclick="sendOrder()">
        Order on WhatsApp
    </button>

    `;

    document.getElementById("cartArea").innerHTML = html;

    let totalItems = 0;

    cart.forEach(item=>{
        totalItems += item.qty;
    });

    document.getElementById("cartButton").innerHTML =
    `🛒 Cart (${totalItems})`;

    document.getElementById("cartButton").onclick =
    toggleCart;

}
function refreshUI(){

    saveCart();

    showCart();

    displayProducts(currentProducts);

}


function increaseQty(index){

    cart[index].qty++;

    refreshUI();

}


function decreaseQty(index){

    if(cart[index].qty > 1){

        cart[index].qty--;

    }
    else{

        cart.splice(index,1);

    }

    refreshUI();

}

function removeItem(index){

    cart.splice(index,1);

    refreshUI();
}
  // Loose or Box order
function changeOrderType(index,type){

    cart[index].orderType = type;

    saveCart();

    showCart();

 }

function sendOrder(){

    if(cart.length === 0){

        alert("Cart is empty!");

        return;
    }

    let name =
    document.getElementById("customerName").value.trim();

    let mobile =
    document.getElementById("customerMobile").value.trim();

    let address =
    document.getElementById("customerAddress").value.trim();

    if(name === ""){

        alert("Please enter Customer Name");

        return;
    }

    if(!/^[6-9]\d{9}$/.test(mobile)){

        alert("Please enter a valid 10 digit Mobile Number");

        return;
    }

    let total = 0;
    let totalProducts = cart.length;
    let msg =
`Hello Deepak Medical Agency

Customer Name: ${name}

Mobile Number: ${mobile}

Address: ${address}

Order Details:

`;

    cart.forEach(item => {

        total += item.price * item.qty;

        msg += `🔹 ${item.name} (${item.packing})

      Qty : ${item.qty} | Amount : ₹${(item.price * item.qty).toFixed(2)}

       `;


    });

    msg += `━━━━━━━━━━━━━━

   Total Products : ${totalProducts}

   Total Amount : ₹${total.toFixed(2)}`;

  let productList = "";

cart.forEach(item => {

 productList +=
 `🔹 ${item.name} (${item.packing})

 Qty : ${item.qty} | Amount : ₹${(item.price * item.qty).toFixed(2)}

 `;

});

fetch("https://script.google.com/macros/s/AKfycbwVDN0OlZ5srpTFPFEIR0O0B43Oe5vcHap70EJcfBtsbXuPLy8QdKMTs8NtwaJ3JRnGxA/exec",{

method:"POST",

mode:"no-cors",

body:JSON.stringify({

secret:"DeepakMedical2026",

name:name,

mobile:mobile,

address:address,

products:productList,

total:total.toFixed(2)

})

})
.catch(error => {

    console.error("Order log to Sheet failed:", error);

});
    window.open(
"https://wa.me/917804008789?text=" +
encodeURIComponent(msg)
    );

cart = [];

localStorage.removeItem("cart");

localStorage.removeItem("cartTime");

showCart();

closeCart();
}
function toggleCart(){

    if(cart.length === 0){
        return;
    }

    const cartArea = document.getElementById("cartArea");

    if(cartOpen){

        cartArea.style.transform = "translateX(100%)";
        cartOpen = false;

    }else{

        cartArea.style.transform = "translateX(0)";
        cartOpen = true;

    }

}

function closeCart(){

    document.getElementById("cartArea")
    .style.transform = "translateX(100%)";

    cartOpen = false;
}


/* =========================================================
   PRODUCT IMAGE ZOOM / AMAZON STYLE VIEWER
   ---------------------------------------------------------
   Features:
   - One large image at a time
   - Small thumbnails on left side
   - Thumbnail click changes large image
   - Image stays inside screen
   - Outside area click closes zoom
========================================================= */

function openImageZoom(images){


    /* =====================================================
       SUPPORT SINGLE IMAGE + MULTIPLE IMAGES
       -----------------------------------------------------
       Old product:
       openImageZoom("images/product.jpg")

       New product:
       openImageZoom([
           "images/front.jpg",
           "images/back.jpg"
       ])
    ===================================================== */

    if(!Array.isArray(images)){

        images = [images];

    }


    /* =====================================================
       CREATE OVERLAY
    ===================================================== */

    const overlay = document.createElement("div");

    overlay.className = "image-zoom-overlay";


    /* =====================================================
       CREATE AMAZON-STYLE VIEWER
       -----------------------------------------------------
       Left  = thumbnails
       Right = one large image
    ===================================================== */

    overlay.innerHTML = `

        <div class="zoom-viewer">


            <!-- =================================================
                 LEFT THUMBNAIL SIDEBAR
            ================================================== -->

            <div class="zoom-sidebar">

                ${
                    images.map((image, index) => `

                        <div
                            class="zoom-sidebar-thumb ${
                                index === 0 ? "active" : ""
                            }"
                            data-image="${image}">

                            <img
                                src="${image}"
                                alt="Product image ${index + 1}">

                        </div>

                    `).join("")
                }

            </div>


            <!-- =================================================
                 LARGE IMAGE AREA
                 ONLY ONE IMAGE IS DISPLAYED HERE
            ================================================== -->

            <div class="zoom-main-image">

                <img
                    src="${images[0]}"
                    class="zoomed-image"
                    alt="Product Image">

            </div>


        </div>

    `;


    /* =====================================================
       ADD OVERLAY TO BODY
    ===================================================== */

    document.body.appendChild(overlay);


    /* =====================================================
       START OVERLAY ANIMATION
    ===================================================== */

    requestAnimationFrame(() => {

        overlay.classList.add("active");

    });


    /* =====================================================
       GET MAIN IMAGE
    ===================================================== */

    const mainImage =
        overlay.querySelector(".zoomed-image");


    /* =====================================================
       GET ALL THUMBNAILS
    ===================================================== */

    const thumbnails =
        overlay.querySelectorAll(".zoom-sidebar-thumb");


    /* =====================================================
       THUMBNAIL CLICK
       -----------------------------------------------------
       Only main image changes.
       Other images are NOT added to screen.
    ===================================================== */

    thumbnails.forEach(thumbnail => {

        thumbnail.addEventListener("click", function(event){

            event.stopPropagation();


            /* Change large image */

            mainImage.src =
                this.dataset.image;


            /* Remove active border */

            thumbnails.forEach(item => {

                item.classList.remove("active");

            });


            /* Highlight selected thumbnail */

            this.classList.add("active");

        });

    });


    /* =========================================================
   CLOSE ZOOM WHEN CLICKING / TAPPING OUTSIDE VIEWER
   ---------------------------------------------------------
   - Main image par click  → kuch nahi hoga
   - Thumbnail par click   → image change hogi
   - Viewer ke empty area  → zoom close
   - Screen ke kisi bhi
     dark/empty area par    → zoom close
   - Mobile tap bhi work karega
    ========================================================= */

    overlay.addEventListener("click", function(event){

      const clickedImage =
        event.target.closest(".zoomed-image");

      const clickedThumbnail =
        event.target.closest(".zoom-sidebar-thumb");

     /*  Large image ya thumbnail par click hua
       to overlay close nahi hoga.
      */

        if(clickedImage || clickedThumbnail){

          return;

         }


       /*
       Baaki kahin bhi click hua:
       zoom close.
      */

        closeImageZoom(overlay);

     });

}

/* =========================================================
   CLOSE PRODUCT IMAGE ZOOM
   ---------------------------------------------------------
   Zoom overlay ko smoothly close karta hai.
========================================================= */

function closeImageZoom(overlay){

    /* Remove active class for closing animation */

    overlay.classList.remove("active");


    /* Wait for CSS fade-out animation */

    setTimeout(() => {

        if(overlay && overlay.parentNode){

            overlay.parentNode.removeChild(overlay);

        }

    }, 250);

}

/* =========================================================
   ESC KEY CLOSE
========================================================= */

document.addEventListener("keydown", function(event){

    if(event.key === "Escape"){

        const overlay =
            document.querySelector(".image-zoom-overlay");

        if(overlay){

            closeImageZoom(overlay);

        }

    }

});

/* =========================================================
   MOBILE STICKY HEADER — HIDE LOGO ON SCROLL DIRECTION
   ---------------------------------------------------------
   Transition ke dauraan (300ms) naye scroll events ko
   ignore karta hai — isse layout-shift se hone wala
   feedback loop / flicker nahi hota.
========================================================= */

const siteHeader = document.querySelector("header");

let lastScrollY = window.scrollY;
let isCompact = false;
let ticking = false;
let locked = false;

const MIN_MOVEMENT = 8;
const TOP_SAFE_ZONE = 20;
const TRANSITION_TIME = 320;   // CSS transition (.3s) se thoda zyada

function setCompact(state){

    if(state === isCompact) return;

    isCompact = state;

    if(state){
        siteHeader.classList.add("header-compact");
    }else{
        siteHeader.classList.remove("header-compact");
    }

    locked = true;

    setTimeout(() => {
        locked = false;
    }, TRANSITION_TIME);

}

function updateHeaderState(){

    const scrollY = window.scrollY;

    const diff = scrollY - lastScrollY;

    if(window.innerWidth <= 768 && !locked){

        if(scrollY < TOP_SAFE_ZONE){

            setCompact(false);

        }
        else if(diff > MIN_MOVEMENT){

            setCompact(true);

        }
        else if(diff < -MIN_MOVEMENT){

            setCompact(false);

        }

    }

    lastScrollY = scrollY;
    ticking = false;

}

window.addEventListener("scroll", () => {

    if(!ticking){

        window.requestAnimationFrame(updateHeaderState);
        ticking = true;

    }

}, { passive:true });

/* adding slider code 
// =================== Slider ===================

let currentSlide = 0;

const slides = document.querySelector(".slides");

const slideImages = document.querySelectorAll(".slides img");

const totalSlides = slideImages.length;

function updateSlider(){

    slides.style.transform =
    `translateX(-${currentSlide * 100}%)`;

}

function nextSlide(){

    currentSlide++;

    if(currentSlide >= totalSlides){

        currentSlide = 0;

    }

    updateSlider();

}

function prevSlide(){

    currentSlide--;

    if(currentSlide < 0){

        currentSlide = totalSlides - 1;

    }

    updateSlider();

}

document.querySelector(".next")
.addEventListener("click",nextSlide);

document.querySelector(".prev")
.addEventListener("click",prevSlide);

setInterval(nextSlide,4000);
*/