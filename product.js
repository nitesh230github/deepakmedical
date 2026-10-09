/* =========================================================
   product.js - sirf product pages (/medicine/<naam>/) ke liye
   ---------------------------------------------------------
   Kya karta hai:
     1. Cart: homepage wala hi cart (localStorage "cart") use karta hai,
        isliye yahan add kiya hua item homepage ke cart me bhi dikhta hai
     2. Add to Cart / qty box (type karke bhi badal sakte ho) + "Item Added" message
     3. Image gallery (thumbnail click) + badi image par click = zoom
     4. Share button
   Page ka HTML build_product_pages.py banata hai. Iska cart code script.js se match rakho.
========================================================= */

(function(){

    const CART_EXPIRY_MS = 24 * 60 * 60 * 1000;   // script.js ke CONFIG.CART_EXPIRY_MS jaisa
    const MAX_QTY = 9999;                          // script.js ke CONFIG.MAX_QTY jaisa
    const ADDED_FLASH_MS = 1200;


    /* ---------- Cart (localStorage) ---------- */

    function loadCart(){

        try{

            let cart = JSON.parse(localStorage.getItem("cart")) || [];

            const savedTime = Number(localStorage.getItem("cartTime"));

            if(savedTime && Date.now() - savedTime > CART_EXPIRY_MS){

                localStorage.removeItem("cart");
                localStorage.removeItem("cartTime");

                cart = [];

            }

            return Array.isArray(cart) ? cart : [];

        }catch(error){

            return [];

        }

    }

    function saveCart(cart){

        try{

            localStorage.setItem("cart", JSON.stringify(cart));
            localStorage.setItem("cartTime", Date.now());

        }catch(error){

            console.error("Cart save failed:", error);

        }

    }

    /* Header ke Cart button me total qty */
    function updateCartCount(){

        const total = loadCart().reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

        const button = document.getElementById("cartButton");

        if(button) button.textContent = `🛒 Cart (${total})`;

    }


    /* ---------- Add to Cart / Qty box ---------- */

    const area = document.getElementById("pdCartArea");

    let product = null;

    try{

        product = JSON.parse(area.dataset.product);

    }catch(error){

        console.error("Product data missing:", error);

    }

    function currentQty(){

        const item = loadCart().find(x => x.id === product.id);

        return item ? item.qty : 0;

    }

    function setQty(qty){

        const cart = loadCart();

        const index = cart.findIndex(x => x.id === product.id);

        if(qty <= 0){

            if(index !== -1) cart.splice(index, 1);

        }else if(index !== -1){

            cart[index].qty = qty;

        }else{

            // Homepage wale cart item jaisa hi shape
            cart.push({
                id: product.id,
                name: product.name,
                packing: product.packing,
                image: product.image,
                price: Number(product.price),
                qty: qty
            });

        }

        saveCart(cart);

        renderBuyArea();

        updateCartCount();

    }

    function renderBuyArea(){

        if(!product) return;

        if(product.inStock === false){

            area.innerHTML = `<button type="button" class="pd-add" disabled>Out of Stock</button>`;

            return;

        }

        const qty = currentQty();

        if(qty === 0){

            area.innerHTML = `<button type="button" class="pd-add" data-action="add">Add to Cart</button>`;

        }else{

            area.innerHTML = `
                <div class="qty-box">
                    <div class="qty-btn minus" data-action="minus">&minus;</div>
                    <input class="qty-input" type="text" inputmode="numeric" pattern="[0-9]*"
                           maxlength="4" value="${qty}" aria-label="Quantity">
                    <div class="qty-btn plus" data-action="plus">&plus;</div>
                </div>
                <a class="pd-viewcart" href="/#cart">View Cart &rarr;</a>`;

        }

    }

    /* "Item Added" message (homepage jaisa) */
    function showAddedFlash(){

        area.querySelector(".added-toast")?.remove();

        const toast = document.createElement("div");

        toast.className = "added-toast";
        toast.setAttribute("role", "status");
        toast.textContent = "✔ Item Added";

        area.appendChild(toast);

        setTimeout(() => toast.remove(), ADDED_FLASH_MS + 100);

    }

    if(area && product){

        area.addEventListener("click", event => {

            const target = event.target.closest("[data-action]");

            if(!target) return;

            const action = target.dataset.action;

            if(action === "add"){

                setQty(1);

                showAddedFlash();

            }else if(action === "plus"){

                setQty(Math.min(currentQty() + 1, MAX_QTY));

            }else if(action === "minus"){

                setQty(currentQty() - 1);

            }

        });

        // Qty box me type karna
        area.addEventListener("input", event => {

            if(event.target.matches(".qty-input")){
                event.target.value = event.target.value.replace(/\D/g, "");
            }

        });

        area.addEventListener("focusin", event => {

            if(event.target.matches(".qty-input")){
                setTimeout(() => event.target.select(), 0);
            }

        });

        area.addEventListener("keydown", event => {

            if(event.key === "Enter" && event.target.matches(".qty-input")){
                event.target.blur();
            }

        });

        area.addEventListener("change", event => {

            if(!event.target.matches(".qty-input")) return;

            const digits = event.target.value.replace(/\D/g, "");

            if(digits === ""){
                event.target.value = currentQty();     // khaali chhoda -> purani qty
                return;
            }

            setQty(Math.min(parseInt(digits, 10), MAX_QTY));

        });

        renderBuyArea();

    }

    updateCartCount();

    // Back button se aane par (page cache se) cart count dobara dikhao
    window.addEventListener("pageshow", event => {

        updateCartCount();

        // Sirf cache se wapas aane par (page load par nahi), warna chalta hua "Item Added" mit jaata
        if(event.persisted){
            renderBuyArea();
        }

    });


    /* ---------- Gallery: thumbnail click -> badi image badle ---------- */

    const mainImage = document.getElementById("pdMainImage");

    document.querySelectorAll(".pd-thumb").forEach(thumb => {

        thumb.addEventListener("click", () => {

            mainImage.src = thumb.dataset.src;

            document.querySelectorAll(".pd-thumb").forEach(t => t.classList.remove("active"));

            thumb.classList.add("active");

        });

    });

    // Badi image par click = zoom viewer (saari images ke thumbnails ke saath)
    if(mainImage){

        mainImage.addEventListener("click", () => {

            const sources = [...document.querySelectorAll(".pd-thumb")].map(t => t.dataset.src);

            const list = sources.length ? sources : [mainImage.src];

            const activeIndex = Math.max(0, list.indexOf(mainImage.getAttribute("src")));

            openImageZoom(list, activeIndex);

        });

    }


    /* ---------- Image zoom viewer (script.js wala hi design, style.css ke classes) ---------- */

    function escapeAttr(value){

        return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
                            .replace(/</g, "&lt;").replace(/>/g, "&gt;");

    }

    function openImageZoom(images, activeIndex){

        const overlay = document.createElement("div");

        overlay.className = "image-zoom-overlay";

        overlay.innerHTML = `
            <div class="zoom-viewer">
                <div class="zoom-sidebar">
                    ${images.length > 1 ? images.map((src, i) => `
                        <div class="zoom-sidebar-thumb ${i === activeIndex ? "active" : ""}" data-image="${escapeAttr(src)}">
                            <img src="${escapeAttr(src)}" alt="Product image ${i + 1}">
                        </div>`).join("") : ""}
                </div>
                <div class="zoom-main-image">
                    <img src="${escapeAttr(images[activeIndex])}" class="zoomed-image" alt="Product Image">
                </div>
            </div>`;

        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.classList.add("active"));

        const big = overlay.querySelector(".zoomed-image");

        const thumbs = overlay.querySelectorAll(".zoom-sidebar-thumb");

        thumbs.forEach(thumb => {

            thumb.addEventListener("click", event => {

                event.stopPropagation();

                big.src = thumb.dataset.image;

                thumbs.forEach(t => t.classList.remove("active"));

                thumb.classList.add("active");

            });

        });

        overlay.addEventListener("click", event => {

            if(event.target.closest(".zoomed-image") || event.target.closest(".zoom-sidebar-thumb")) return;

            closeImageZoom(overlay);

        });

    }

    function closeImageZoom(overlay){

        overlay.classList.remove("active");

        setTimeout(() => overlay.remove(), 250);

    }

    document.addEventListener("keydown", event => {

        if(event.key !== "Escape") return;

        const overlay = document.querySelector(".image-zoom-overlay");

        if(overlay) closeImageZoom(overlay);

    });


    /* ---------- Share ---------- */

    const shareButton = document.getElementById("pdShare");

    if(shareButton){

        shareButton.addEventListener("click", async () => {

            const title = shareButton.dataset.title;
            const url = shareButton.dataset.url;

            // Mobile par phone ka apna share menu
            if(navigator.share){

                try{

                    await navigator.share({ title: title, text: title + " - Deepak Medical Agency", url: url });

                }catch(error){

                    // Customer ne share cancel kar diya, koi baat nahi

                }

                return;

            }

            // Desktop: WhatsApp share link
            window.open("https://wa.me/?text=" + encodeURIComponent(title + "\n" + url), "_blank", "noopener");

        });

    }

})();
