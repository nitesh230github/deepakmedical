let cart = [];

fetch("products.json")
.then(response => response.json())
.then(products => {

    displayProducts(products);

    function filterProducts() {

        let searchValue =
        document.getElementById("search").value.toLowerCase();

        let categoryValue =
        document.getElementById("categoryFilter").value;

        let filtered = products.filter(product => {

            let matchName =
            product.name.toLowerCase().includes(searchValue);

            let matchCategory =
            categoryValue === "ALL" ||
            product.category === categoryValue;

            return matchName && matchCategory;

        });

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

            <p class="price">₹${product.price}</p>

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
}

function showCart(){

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

document.getElementById("cartButton")
.onclick = openCart;
}

function increaseQty(index){

    cart[index].qty++;

    showCart();
}

function decreaseQty(index){

    if(cart[index].qty > 1){
        cart[index].qty--;
    }

    showCart();
}

function removeItem(index){

    cart.splice(index,1);

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
    fetch("https://script.google.com/macros/s/AKfycbzpO7Wqq5ip9Kn6dzdRl-djWYoAHn3xrq-rU-9QiF5vJQ_4MGO7kRyo-7XH82MsrTjDUg/exec",{

method:"POST",

body:JSON.stringify({

secret:"DeepakMedical2026",

name:name,

mobile:mobile,

address:address,

products:msg,

total:total.toFixed(2)

})

});
    window.open(
"https://wa.me/917804008789?text=" +
encodeURIComponent(msg)
    );

}

function openCart(){

    document.getElementById("cartArea")
    .style.right = "0";

}

function closeCart(){

    document.getElementById("cartArea")
    .style.right = "-400px";

}



