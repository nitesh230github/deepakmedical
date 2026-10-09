#!/usr/bin/env python3
"""
build_product_pages.py - har product ka apna page banata hai.

products.json padhta hai aur banata hai:
  medicine/<slug>/index.html   -> har product ka page (jaise /medicine/calpol-650-tab/)
  sitemap.xml                  -> home + saare product pages (Google ke liye)
  products.json                -> har product me "url" field jod deta hai (homepage isi se link banata hai)

Repo ke root folder se chalao:
    python scripts/build_product_pages.py

products.json me ye optional fields use hote hain (Excel me column bana do):
    description : apna likha description. Khaali ho to auto template banta hai.
    rx          : "no" / "n" / "0" / false likhoge to Rx hat jaayega. Khaali ya kuch aur = Rx (default).
    slug        : URL ka naam khud tay karna ho to (warna naam se banta hai).
    images / image, saltContent, uses, company, packing, price, category, inStock, id, name

NOTE: Product ka naam badloge to URL bhi badal jaayega (purane shared link toot jayenge).
      Isliye share hone ke baad naam na badlo, ya "slug" column me purana slug fix kar do.
"""

import html
import json
import os
import re
import shutil
import sys
from datetime import date
from urllib.parse import quote

# ---------------------------------------------------------
# SETTINGS
# ---------------------------------------------------------
SITE = "https://deepakmedical.vercel.app"
WHATSAPP_NUMBER = "917804008789"
SHOP_NAME = "Deepak Medical Agency"
PRODUCTS_JSON = "products.json"
OUT_DIR = "medicine"
SITEMAP = "sitemap.xml"
MAX_SIMILAR = 12                      # similar salt wale kitne products dikhane hain

CATEGORY_LABELS = {
    "TABLET_CAP": "Tablets & Capsules",
    "LIQUID": "Syrups & Liquids",
    "CREAM_OINT": "Creams & Ointments",
    "DROP": "Drops",
    "OTHERS": "Others",
}

CATEGORY_FALLBACK_FORM = {
    "TABLET_CAP": "tablet / capsule",
    "LIQUID": "syrup / liquid",
    "CREAM_OINT": "cream / ointment",
    "DROP": "drops",
    "OTHERS": "healthcare product",
}

FORM_PATTERNS = [
    (r"\b(tab|tablet|tablets)\b", "tablet"),
    (r"\b(cap|capsule|capsules)\b", "capsule"),
    (r"\b(syp|syrup|susp|suspension|emulsion|liquid)\b", "syrup / liquid"),
    (r"\bcream\b", "cream"),
    (r"\b(oint|ointment)\b", "ointment"),
    (r"\b(drop|drops)\b", "drops"),
    (r"\bgel\b", "gel"),
    (r"\bsoap\b", "soap"),
    (r"\b(powd|powder)\b", "powder"),
    (r"\boil\b", "oil"),
    (r"\blotion\b", "lotion"),
    (r"\bspray\b", "spray"),
    (r"\b(inj|injection)\b", "injection"),
    (r"\bkit\b", "kit"),
]

e = html.escape          # HTML me safe text


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------
def slugify(text):
    """'Calpol 650 Tab' -> 'calpol-650-tab'"""
    text = re.sub(r"[^a-z0-9]+", "-", str(text).lower())
    return text.strip("-") or "product"


def article(word):
    return "an" if word[:1].lower() in "aeiou" else "a"


def form_of(product):
    name = str(product.get("name", "")).lower()
    for pattern, label in FORM_PATTERNS:
        if re.search(pattern, name):
            return label
    return CATEGORY_FALLBACK_FORM.get(product.get("category"), "healthcare product")


def is_rx(product):
    """Default: sab Rx. 'no' / 'n' / '0' / false likhne par hi Rx hatega."""
    value = product.get("rx")
    if value is None or value == "":
        return True
    return str(value).strip().lower() not in ("no", "n", "0", "false", "nahi", "na", "non-rx", "non rx", "nonrx", "otc")


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def salt_key(salt):
    """
    Salt ko ek 'chaabi' me badlo, taaki EXACT same composition match ho.
      "Paracetamol 650mg"                        -> "paracetamol650mg"
      "Amoxycillin 500mg + Clavulanic Acid 125mg" -> components sort hote hain,
         isliye "A + B" aur "B + A" same maane jaate hain.
    Strength (650mg) key ka hissa hai, isliye 500mg aur 650mg kabhi match nahi honge.
    """
    text = clean_text(salt).lower()
    if not text:
        return ""
    text = re.sub(r"\b(ip|bp|usp)\b", " ", text)            # IP/BP/USP likha ho ya na ho, farak nahi
    parts = re.split(r"\s*(?:\+|;|,|&|\band\b)\s*", text)
    parts = [re.sub(r"[^a-z0-9.%/]", "", p) for p in parts]
    parts = sorted(p for p in parts if p)
    return "+".join(parts)


def img_path(path):
    """'images/a b.jpg' -> '/images/a%20b.jpg'"""
    path = str(path or "").strip()
    if not path:
        return "/images/website_images/logo.png"
    if path.startswith(("http://", "https://")):
        return path
    return "/" + quote(path.lstrip("/"), safe="/")


def images_of(product):
    imgs = product.get("images")
    if isinstance(imgs, list) and imgs:
        return [i for i in imgs if i]
    return [product["image"]] if product.get("image") else []


def money(value):
    try:
        n = float(value)
        return str(int(n)) if n == int(n) else f"{n:.2f}"
    except (TypeError, ValueError):
        return str(value)


def auto_description(p):
    """description column khaali ho to ye template use hota hai."""
    name = clean_text(p.get("name"))
    form = form_of(p)
    company = clean_text(p.get("company"))
    salt = clean_text(p.get("saltContent"))
    uses = clean_text(p.get("uses"))
    packing = clean_text(p.get("packing"))

    paras = []
    intro = f"{name} is {article(form)} {form}"
    intro += f" from {company}." if company else "."
    paras.append(intro)
    if salt:
        paras.append(f"Salt composition: {salt}.")
    if uses:
        paras.append(f"Commonly used for: {uses}.")
    line = []
    if packing:
        line.append(f"Pack size: {packing}.")
    if p.get("price") not in (None, ""):
        line.append(f"MRP: \u20b9{money(p['price'])}.")
    if line:
        paras.append(" ".join(line))
    paras.append(f"Available at {SHOP_NAME}, Rewa & Mauganj with fast and free delivery.")
    return paras


def description_paragraphs(p):
    custom = str(p.get("description") or "").strip()
    if custom:
        return [clean_text(x) for x in re.split(r"\n+", custom) if clean_text(x)]
    return auto_description(p)


def json_ld(data):
    """<script> ke andar safe JSON."""
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/")


def short(text, limit=160):
    text = clean_text(text)
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "\u2026"


# ---------------------------------------------------------
# PAGE TEMPLATE
# ---------------------------------------------------------
def similar_cards(items):
    cards = []
    for s in items:
        stock = "" if s.get("inStock") is not False else '<span class="sim-oos">Out of Stock</span>'
        cards.append(f"""
            <a class="sim-card" href="{e(s['url'])}">
                <img src="{e(img_path((images_of(s) or [''])[0]))}" alt="{e(s.get('name', ''))}" loading="lazy" decoding="async">
                <span class="sim-name">{e(s.get('name', ''))}</span>
                <span class="sim-company">{e(clean_text(s.get('company')))}{' &middot; ' + e(clean_text(s.get('packing'))) if clean_text(s.get('packing')) else ''}</span>
                <span class="sim-price">MRP \u20b9{e(money(s.get('price')))}</span>
                {stock}
            </a>""")
    return "".join(cards)


def build_page(p, similar, similar_total):
    name = clean_text(p.get("name"))
    company = clean_text(p.get("company"))
    packing = clean_text(p.get("packing"))
    salt = clean_text(p.get("saltContent"))
    uses = clean_text(p.get("uses"))
    category = p.get("category")
    in_stock = p.get("inStock") is not False
    rx = is_rx(p)
    url = SITE + p["url"]
    imgs = images_of(p)
    abs_imgs = [img_path(i) for i in imgs] or [img_path("")]
    og_image = abs_imgs[0] if abs_imgs[0].startswith("http") else SITE + abs_imgs[0]

    paras = description_paragraphs(p)
    meta_desc = short(
        f"{name}{' (' + packing + ')' if packing else ''}"
        f"{' by ' + company if company else ''}. MRP \u20b9{money(p.get('price'))}. "
        f"{'Salt: ' + salt + '. ' if salt else ''}"
        f"Buy from {SHOP_NAME}, Rewa & Mauganj with free delivery."
    )
    title = f"{name} | {SHOP_NAME}, Rewa"

    cart_data = {
        "id": p.get("id"),
        "name": name,
        "packing": packing,
        "price": p.get("price"),
        "image": imgs[0] if imgs else "",
        "inStock": in_stock,
    }

    # ---- structured data ----
    product_ld = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "image": [i if i.startswith("http") else SITE + i for i in abs_imgs],
        "description": " ".join(paras),
        "sku": str(p.get("id", "")),
        "url": url,
    }
    if company:
        product_ld["brand"] = {"@type": "Brand", "name": company}
    try:
        product_ld["offers"] = {
            "@type": "Offer",
            "url": url,
            "priceCurrency": "INR",
            "price": money(p["price"]),
            "availability": "https://schema.org/InStock" if in_stock else "https://schema.org/OutOfStock",
            "seller": {"@type": "Organization", "name": SHOP_NAME},
        }
    except KeyError:
        pass

    crumbs_ld = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": CATEGORY_LABELS.get(category, "Products"),
             "item": f"{SITE}/?cat={category}" if category in CATEGORY_LABELS else SITE + "/"},
            {"@type": "ListItem", "position": 3, "name": name, "item": url},
        ],
    }

    # ---- gallery ----
    thumbs = ""
    if len(abs_imgs) > 1:
        thumbs = '<div class="pd-thumbs">' + "".join(
            f'<button type="button" class="pd-thumb{" active" if i == 0 else ""}" data-src="{e(src)}" '
            f'aria-label="Image {i + 1}"><img src="{e(src)}" alt="" loading="lazy"></button>'
            for i, src in enumerate(abs_imgs)
        ) + "</div>"

    stock_badge = (
        '<span class="stock-badge in-stock"><span class="stock-dot"></span>In Stock</span>'
        if in_stock else
        '<span class="stock-badge out-of-stock"><span class="stock-dot"></span>Out of Stock</span>'
    )
    rx_badge = '<span class="rx-badge" title="Prescription required">Rx &middot; Prescription medicine</span>' if rx else ""

    facts = []
    if packing:
        facts.append(f"<li><span>Pack</span><strong>{e(packing)}</strong></li>")
    if company:
        facts.append(f"<li><span>Mfg / Mkt</span><strong>{e(company)}</strong></li>")
    if salt:
        facts.append(f"<li><span>Salt</span><strong>{e(salt)}</strong></li>")
    if category in CATEGORY_LABELS:
        facts.append(f"<li><span>Category</span><strong>{e(CATEGORY_LABELS[category])}</strong></li>")

    wa_text = f"Hello {SHOP_NAME}, mujhe {name}{' (' + packing + ')' if packing else ''} ke bare me jaankari chahiye.\n{url}"
    wa_link = f"https://wa.me/{WHATSAPP_NUMBER}?text=" + quote(wa_text)

    sections = [f'<section class="pd-section"><h2>Description</h2>{"".join("<p>" + e(x) + "</p>" for x in paras)}</section>']
    if salt:
        sections.append(f'<section class="pd-section"><h2>Salt Composition</h2><p class="pd-salt">{e(salt)}</p></section>')
    if uses:
        sections.append(f'<section class="pd-section"><h2>Uses</h2><p>{e(uses)}</p></section>')
    if similar:
        more = f'<p class="pd-more">Aur {similar_total - len(similar)} products isi salt composition ke hain.</p>' if similar_total > len(similar) else ""
        sections.append(
            '<section class="pd-section"><h2>Products with similar salt composition</h2>'
            f'<p class="pd-sub">Salt: {e(salt)}</p>'
            f'<div class="pd-similar">{similar_cards(similar)}</div>{more}</section>'
        )

    disclaimer = (
        "This is a prescription (Rx) medicine. Please use it only as advised by a registered doctor. "
        if rx else ""
    ) + (
        "Information on this page is for general reference only and is not a substitute for medical advice. "
        "Product images are for representation. Please check the pack for exact details."
    )

    return f"""<!DOCTYPE html>
<html lang="en-IN">
<head>
    <!-- Ye page build_product_pages.py ne banaya hai. Seedha edit mat karo, products.json / Excel me badlo. -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{e(title)}</title>
    <meta name="description" content="{e(meta_desc)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="{e(url)}">
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">

    <meta property="og:type" content="product">
    <meta property="og:site_name" content="{e(SHOP_NAME)}, Rewa">
    <meta property="og:title" content="{e(name)} | {e(SHOP_NAME)}">
    <meta property="og:description" content="{e(meta_desc)}">
    <meta property="og:url" content="{e(url)}">
    <meta property="og:image" content="{e(og_image)}">

    <script type="application/ld+json">{json_ld(product_ld)}</script>
    <script type="application/ld+json">{json_ld(crumbs_ld)}</script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="/product.css">
</head>

<body class="product-page">

<header>
    <div class="header-top">

        <a class="logo-section" href="/" aria-label="{e(SHOP_NAME)} home">
            <img src="/images/website_images/logo.png" class="logo" alt="{e(SHOP_NAME)} logo">
            <div class="brand">
                <div class="brand-name">{e(SHOP_NAME)}</div>
                <p>\u0938\u0939\u0940 \u0926\u0935\u093e\U0001F48A \u0938\u0939\u0940 \u0926\u093e\u092e\U0001F4B0 FREE &amp; FAST Delivery\U0001F69A</p>
            </div>
        </a>

        <!-- Search: home page par le jaata hai (/?q=...) -->
        <form class="search-cart" action="/" method="get" role="search">
            <input type="text" name="q" class="search-box" placeholder="\U0001F50D Search Medicines..." aria-label="Search Medicines">
            <a id="cartButton" href="/#cart">\U0001F6D2 Cart (0)</a>
        </form>

    </div>
</header>

<main class="product-detail">

    <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a> <span>&rsaquo;</span>
        {'<a href="/?cat=' + e(category) + '">' + e(CATEGORY_LABELS[category]) + '</a> <span>&rsaquo;</span>' if category in CATEGORY_LABELS else ''}
        <span class="crumb-current">{e(name)}</span>
    </nav>

    <section class="pd-top">

        <div class="pd-gallery">
            <div class="pd-main">
                <img id="pdMainImage" src="{e(abs_imgs[0])}" alt="{e(name)}" title="Click to zoom">
            </div>
            {thumbs}
        </div>

        <div class="pd-info">

            <h1>{e(name)}</h1>
            {'<p class="pd-company">by ' + e(company) + '</p>' if company else ''}

            <div class="pd-badges">{stock_badge}{rx_badge}</div>

            <div class="pd-price"><span>MRP</span> \u20b9{e(money(p.get('price')))}</div>

            <ul class="pd-facts">{"".join(facts)}</ul>

            <!-- Add to Cart: product.js yahan button / qty box banata hai -->
            <div class="pd-buy" id="pdCartArea" data-product="{e(json.dumps(cart_data, ensure_ascii=False))}">
                {'<button type="button" class="pd-add" disabled>Out of Stock</button>' if not in_stock else '<button type="button" class="pd-add">Add to Cart</button>'}
            </div>

            <div class="pd-actions">
                <a class="pd-wa" href="{e(wa_link)}" target="_blank" rel="noopener noreferrer">\U0001F4AC Enquire on WhatsApp</a>
                <button type="button" class="pd-share" id="pdShare" data-title="{e(name)}" data-url="{e(url)}">\U0001F517 Share</button>
            </div>

        </div>

    </section>

    {"".join(sections)}

    <p class="pd-disclaimer">{e(disclaimer)}</p>

</main>

<footer class="site-footer" id="contact">
    <h2>{e(SHOP_NAME)}</h2>
    <p>Wholesale Supply of Medicines &amp; OTC Products in Rewa &amp; Mauganj with FREE delivery.</p>
    <div class="social-icons">
        <a href="https://www.facebook.com/share/1DoJ9zAbfs/" target="_blank" rel="noopener noreferrer" class="social-icon facebook" aria-label="Facebook" title="Facebook">
            <img src="/images/social/facebook.svg" alt="Facebook" width="48" height="48" loading="lazy">
        </a>
        <a href="https://www.instagram.com/deepakmedagency/" target="_blank" rel="noopener noreferrer" class="social-icon instagram" aria-label="Instagram" title="Instagram">
            <img src="/images/social/instagram.svg" alt="Instagram" width="48" height="48" loading="lazy">
        </a>
        <a href="https://wa.me/{WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer" class="social-icon whatsapp" aria-label="WhatsApp" title="WhatsApp par chat karein">
            <img src="/images/social/whatsapp.svg" alt="WhatsApp" width="48" height="48" loading="lazy">
        </a>
    </div>
    <p class="copyright">\u00a9 2026 {e(SHOP_NAME)}. All rights reserved.</p>
</footer>

<script src="/product.js"></script>
</body>
</html>
"""


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------
def main():
    if not os.path.exists(PRODUCTS_JSON):
        sys.exit(f"{PRODUCTS_JSON} nahi mila. Script ko repo ke root folder se chalao.")

    with open(PRODUCTS_JSON, encoding="utf-8") as fh:
        products = json.load(fh)

    # 1) Har product ka slug / url (duplicate naam ho to id jod dete hain)
    used = set()
    for p in products:
        slug = slugify(p.get("slug") or p.get("name"))
        if slug in used:
            slug = f"{slug}-{p.get('id')}"
        used.add(slug)
        p["slug"] = slug
        p["url"] = f"/{OUT_DIR}/{slug}/"

    # 2) Same salt wale products ke group (exact match)
    groups = {}
    for p in products:
        key = salt_key(p.get("saltContent"))
        if key:
            groups.setdefault(key, []).append(p)

    # 3) Purane pages hatao, naye banao
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)

    for p in products:
        key = salt_key(p.get("saltContent"))
        others = [o for o in groups.get(key, []) if o is not p] if key else []
        others.sort(key=lambda o: (o.get("inStock") is False, float(o.get("price") or 0)))
        folder = os.path.join(OUT_DIR, p["slug"])
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, "index.html"), "w", encoding="utf-8") as fh:
            fh.write(build_page(p, others[:MAX_SIMILAR], len(others)))

    # 4) products.json me url jodo
    with open(PRODUCTS_JSON, "w", encoding="utf-8") as fh:
        json.dump(products, fh, ensure_ascii=False, indent=2)

    # 5) sitemap
    today = date.today().isoformat()
    urls = [f"{SITE}/"] + [SITE + p["url"] for p in products]
    with open(SITEMAP, "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            fh.write(f"  <url><loc>{e(u)}</loc><lastmod>{today}</lastmod></url>\n")
        fh.write("</urlset>\n")

    with_similar = sum(1 for p in products if len(groups.get(salt_key(p.get('saltContent')), [])) > 1)
    print(f"{len(products)} product pages bane -> {OUT_DIR}/")
    print(f"{with_similar} products ke paas 'similar salt composition' section hai")
    print(f"{SITEMAP} update hua ({len(urls)} URLs)")


if __name__ == "__main__":
    main()
