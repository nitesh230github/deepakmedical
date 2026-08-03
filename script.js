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

 displayProducts([
    ...bestSellers,
    ...otherProducts
 ]);
 showCart();


    document.getElementById("search")
    .addEventListener("keyup", filterProducts);

    document.getElementById("categoryFilter")
    .addEventListener("change", filterProducts);

});


function filterProducts() {

    let rawSearch = document.getElementById('search').value;    // raw search value stored

    let searchValue = normalizeText(rawSearch);                // normalized search text stored

    let categoryValue =
    document.getElementById("categoryFilter").value;

    let filtered;

    if(categoryValue === "ALL"){

        let bestSellers =
        products.filter(product =>
            product.bestseller &&
            matchesSearch(product, rawSearch)
        );
        bestSellers = shuffleArray(bestSellers);
        
        let otherProducts =
        products.filter(product =>
            !product.bestseller &&
            matchesSearch(product, rawSearch)
        );

        otherProducts = shuffleArray(otherProducts);

        filtered = [
            ...bestSellers,
            ...otherProducts
        ];

    }
    else{

     filtered = products.filter(product =>
            product.category === categoryValue &&
            matchesSearch(product, rawSearch)

        );

        filtered = shuffleArray(filtered);

    }
    

    /* priorty to search text
   filtered.sort((a,b)=>
     getSearchScore(b,rawSearch) -
     getSearchScore(a,rawSearch)

    );  */

displayProducts(filtered);


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

function displayProducts(items){

    let html = "";

    items.forEach(product => {

        html += `
        <div class="card">

            <img src="${product.image}" alt="${product.name}">

            <h3>${product.name}</h3>

             <p class="packing">
             Packing: ${product.packing}
             </p>

              <p class="company">
             Mfg/Mkt: ${product.company}
              </p>

                <p class="price">
               MRP ₹${product.price}
                 </p>

            <button onclick="addToCart('${product.name}',${product.price},'${product.packing}')">
                Add to Cart
            </button>

        </div>
        `;
    });

    document.getElementById("products").innerHTML = html;
}

function addToCart(name,price,packing){

    let item = cart.find(x => x.name === name);

    if(item){
        item.qty++;
    }
    else{
        cart.push({
          name:name,
          price:price,
          packing:packing,
          qty:1,    
        });
    }

    showCart();
    saveCart();
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

    }, 350);

    document.getElementById("cartButton").innerHTML =
    "🛒 Cart (0)";

    document.getElementById("cartButton").onclick =
 toggleCart;

    return;
}
    
    let total = 0;

    let html = `

    <button onclick="closeCart()"> ❌ Close

    </button> <h2> 🛒 Cart </h2>`;

    cart.forEach((item,index)=>{

        total += item.price * item.qty;

        html += `
        <div style="margin-bottom:15px;border-bottom:1px solid #ddd;padding-bottom:10px;">

            <b>${item.name}</b>

           <br><br>

<div class="order-type">

<button
class="${item.orderType === 'Loose' ? 'type-btn active' : 'type-btn'}"
onclick="changeOrderType(${index},'Loose')">

Loose

</button>

<button
class="${item.orderType === 'Box' ? 'type-btn active' : 'type-btn'}"
onclick="changeOrderType(${index},'Box')">

📦 Box

</button>

</div>

<button onclick="decreaseQty(${index})">-</button>

${item.qty}

<button onclick="increaseQty(${index})">+</button>

<button onclick="removeItem(${index})">
❌
</button>
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

    <button onclick="sendOrder()">
        Order on WhatsApp
    </button>

    `;

    document.getElementById("cartArea").innerHTML = html;
    
    let totalItems = 0;

    cart.forEach(item => {

    totalItems += item.qty;

});

document.getElementById("cartButton")
.innerHTML = `🛒 Cart (${totalItems})`;

document.getElementById("cartButton").onclick =
toggleCart;
}

function increaseQty(index){

    cart[index].qty++;

    showCart();
    saveCart();
}

function decreaseQty(index){

    if(cart[index].qty > 1){
        cart[index].qty--;
    }

    showCart();
    saveCart();
}

function removeItem(index){

    cart.splice(index,1);

    showCart();
    saveCart();
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

body:JSON.stringify({

secret:"DeepakMedical2026",

name:name,

mobile:mobile,

address:address,

products:productList,

total:total.toFixed(2)

})

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