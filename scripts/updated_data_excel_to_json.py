"""
products.xlsx  ->  products.json
Repo me ye script `scripts/excel_to_json.py` ke naam se rakho.
Local test: python scripts/excel_to_json.py
"""
import json
import os
import sys
from openpyxl import load_workbook

# ====== SETTINGS (apni repo ke hisaab se badlo) ======
EXCEL_FILE = "products.xlsx"
SHEET_NAME = "Products"
JSON_FILE = "products.json"     # jahan abhi aapka product json hai (e.g. "data/products.json")
IMAGE_FOLDER = "images"         # images folder ka naam
CHECK_IMAGES = True             # image file repo me hai ya nahi, check kare
# =====================================================

TEXT_FIELDS = ["name", "company", "category", "packing", "saltContent", "uses", "image"]
BOOL_FIELDS = ["bestseller", "inStock"]
NULLABLE_FIELDS = ["discount", "scheme"]
ORDER = ["id", "name", "company", "price", "category", "packing", "saltContent",
         "uses", "bestseller", "inStock", "discount", "scheme", "image"]


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v if v != "" else None
    return v


def to_number(v):
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return int(v) if float(v).is_integer() else round(float(v), 2)
    try:
        f = float(str(v).replace(",", "").replace("₹", "").replace("%", "").strip())
        return int(f) if f.is_integer() else round(f, 2)
    except ValueError:
        return None


def to_bool(v, default):
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("true", "yes", "y", "1", "haan", "ha"):
        return True
    if s in ("false", "no", "n", "0", "nahi", "na"):
        return False
    return default


def main():
    if not os.path.exists(EXCEL_FILE):
        sys.exit(f"ERROR: {EXCEL_FILE} nahi mili")

    wb = load_workbook(EXCEL_FILE, data_only=True)
    if SHEET_NAME not in wb.sheetnames:
        sys.exit(f"ERROR: '{SHEET_NAME}' naam ki sheet nahi mili. Sheets: {wb.sheetnames}")
    ws = wb[SHEET_NAME]

    headers = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    missing = [h for h in ("name", "price") if h not in headers]
    if missing:
        sys.exit(f"ERROR: ye columns header me chahiye: {missing}")

    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        rec = {h: clean(v) for h, v in zip(headers, r) if h}
        if not any(rec.values()):
            continue  # khali row skip
        rows.append(rec)

    products, errors, warnings = [], [], []
    used_ids = {to_number(r.get("id")) for r in rows if to_number(r.get("id")) is not None}
    next_id = (max(used_ids) if used_ids else 0) + 1
    seen = set()

    for i, rec in enumerate(rows, start=2):
        name = rec.get("name")
        price = to_number(rec.get("price"))
        if not name:
            errors.append(f"Row {i}: name khali hai")
            continue
        if price is None:
            errors.append(f"Row {i} ({name}): price galat/khali hai")
            continue

        pid = to_number(rec.get("id"))
        if pid is None:
            pid = next_id
            next_id += 1
        if pid in seen:
            errors.append(f"Row {i} ({name}): id {pid} duplicate hai")
            continue
        seen.add(pid)

        p = {"id": pid, "price": price}
        for f in TEXT_FIELDS:
            p[f] = clean(rec.get(f))
        p["bestseller"] = to_bool(rec.get("bestseller"), False)
        p["inStock"] = to_bool(rec.get("inStock"), True)
        for f in NULLABLE_FIELDS:
            v = clean(rec.get(f))
            if v is not None:
                n = to_number(v)
                v = n if n is not None and not isinstance(v, str) else v
            p[f] = v

        # image: sirf file ka naam likha ho to folder jod do
        img = p.get("image")
        if img and "/" not in img and not img.startswith("http"):
            img = f"{IMAGE_FOLDER}/{img}"
            p["image"] = img
        if CHECK_IMAGES and img and not img.startswith("http") and not os.path.exists(img):
            warnings.append(f"Row {i} ({name}): image nahi mili -> {img}")

        products.append({k: p.get(k) for k in ORDER})

    for w in warnings:
        print("WARNING:", w)
    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit("Excel me galtiyan hain, JSON update nahi hua.")

    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"OK: {len(products)} products -> {JSON_FILE}")


if __name__ == "__main__":
    main()
