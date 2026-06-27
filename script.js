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

fetch("products.json")
.then(response => response.json())
.then(products => {

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

   function filterProducts() {

    let searchValue =
    document.getElementById("search").value.toLowerCase();

    let categoryValue =
    document.getElementById("categoryFilter").value;

    let filtered;

    if(categoryValue === "ALL"){

        let bestSellers =
        products.filter(product =>
            product.bestseller &&
            product.name.toLowerCase().includes(searchValue)
        );
        bestSellers = shuffleArray(bestSellers);
        
        let otherProducts =
        products.filter(product =>
            !product.bestseller &&
            product.name.toLowerCase().includes(searchValue)
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

            product.name.toLowerCase().includes(searchValue)

        );

        filtered = shuffleArray(filtered);

    }

    displayProducts(filtered);

}

    document.getElementById("search")
    .addEventListener("keyup", filterProducts);

    document.getElementById("categoryFilter")
    .addEventListener("change", filterProducts);

});

function displayProducts(items){

    let html = "";

    items.forEach(product => {

        html += `
        <div class="card">

            <img src="${product.image}" alt="${product.name}">

            <h3>${product.name}</h3>

             <p class="packing">
             Pack Size: ${product.packing}
             </p>

              <p class="company">
             Mfg/Mkt: ${product.company}
              </p>

                <p class="price">
               ₹${product.price}
                 </p>

            <button onclick="addToCart('${product.name}',${product.price})">
                Add to Cart
            </button>

        </div>
        `;
    });

    document.getElementById("products").innerHTML = html;
}

function addToCart(name,price){

    let item = cart.find(x => x.name === name);

    if(item){
        item.qty++;
    }
    else{
        cart.push({
            name:name,
            price:price,
            qty:1
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

    let msg =
`Hello Deepak Medical Agency

Customer Name: ${name}

Mobile Number: ${mobile}

Address: ${address}

Order Details:

`;

    cart.forEach(item => {

        total += item.price * item.qty;

        msg += `${item.name} × ${item.qty}
₹${item.price * item.qty}

`;

    });

    msg += `Total Amount: ₹${total.toFixed(2)}`;
  let productList = "";

cart.forEach(item => {

    productList +=
`${item.name} × ${item.qty}
₹${(item.price * item.qty).toFixed(2)}

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

/* adding slider code */
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
