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

    showCart();

}
