fetch('products.json')
.then(response => response.json())
.then(products => {

    let productsDiv = document.getElementById('products');

    function displayProducts(items){

        productsDiv.innerHTML = '';

        items.forEach(product  => {

            productsDiv.innerHTML += `
                <div class="card">

                    <img src="${product.image}" alt="${product.name}">

                    <h3>${product.name}</h3>

                    <p class="price">₹${product.price}</p>

                    <button onclick="addToCart('${product.name}')">
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

function addToCart(name){
    alert(name + " added to cart");
}
