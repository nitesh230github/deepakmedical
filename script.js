let cart = [];

fetch("products.json")
.then(response => response.json())
.then(products => {

    displayProducts(products);

    document.getElementById("search")
    .addEventListener("keyup", function(){

        let value = this.value.toLowerCase();

        let filtered = products.filter(product =>
            product.name.toLowerCase().includes(value)
        );

        displayProducts(filtered);

    });

});

function displayProducts(items){

    let html = "";

    items.forEach(product => {

        html += `
        <div class="card">

            <img src="${product.image}" alt="${product.name}">

            <h3>${product.name}</h3>

            <p class="price">₹${product.price}</p>

            <button
            onclick="addToCart('${product.name}',${product.price})">

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

    }else{

        cart.push({

            name:name,
            price:price,
            qty:1

        });

    }
function showCart(){

    let total = 0;

    let html = `
    <h2>🛒 Cart</h2>
    `;

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

    Total ₹${total}

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

    document.getElementById("cartArea")
    .innerHTML = html;

}
    showCart();

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

}
