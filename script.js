let cart = [];

fetch('products.json')
.then(response => response.json())
.then(products => {

    const productsDiv = document.getElementById('products');

    function displayProducts(items) {

        productsDiv.innerHTML = '';

        items.forEach(product => {

            productsDiv.innerHTML += `
            <div class="card">
                <img src="${product.image}">
                <h3>${product.name}</h3>
                <p class="price">₹${product.price}</p>

                <button onclick="addToCart('${product.name}',${product.price})">
                    Add to Cart
                </button>

            </div>
            `;
        });
    }

    displayProducts(products);

    document.getElementById('search').addEventListener('keyup', function(){

        let value = this.value.toLowerCase();

        let filtered = products.filter(product =>
            product.name.toLowerCase().includes(value)
        );

        displayProducts(filtered);

    });

});


function addToCart(name, price){

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

    let html = `
    <hr>
    <h2>🛒 Cart</h2>
    `;

    cart.forEach((item,index)=>{

        html += `
        <p>
        ${item.name}

        <button onclick="decreaseQty(${index})">-</button>

        ${item.qty}

        <button onclick="increaseQty(${index})">+</button>

        </p>
        `;
    });

    html += `

    <br><br>

    <input id="customerName" placeholder="Customer Name">

    <br><br>

    <input id="customerMobile" placeholder="Mobile Number">

    <br><br>

    <button onclick="sendOrder()">
    Order on WhatsApp
    </button>

    `;

    document.getElementById("products").insertAdjacentHTML("afterend",
    `<div id="cartArea">${html}</div>`);
}


function increaseQty(index){

    cart[index].qty++;

    document.getElementById("cartArea").remove();

    showCart();

}


function decreaseQty(index){

    if(cart[index].qty>1){
        cart[index].qty--;
    }

    document.getElementById("cartArea").remove();

    showCart();

}


function sendOrder(){

    let name = document.getElementById("customerName").value;

    let mobile = document.getElementById("customerMobile").value;

    if(name==="" || mobile===""){
        alert("Please enter Name and Mobile Number");
        return;
    }

    let msg =
`Hello Deepak Medical Agency

Customer Name: ${name}

Mobile Number: ${mobile}

Order Details: 

`;

    cart.forEach(item=>{

        msg += `${item.name} × ${item.qty}\n`;

    });

    window.open(
"https://wa.me/917804008789?text="+encodeURIComponent(msg)
);

}
