


const ADMIN_PASSWORD = "adminadmin123mir.com";


const BOT_TOKEN = "9151681389:AAFB5Nyocmfg2iGUD1VN8MdlDNzlHw3DKLY";
const CHAT_ID = "9071336976";

const DEFAULT_PRODUCTS = [];

const $ = s => document.querySelector(s);

const money = n =>
  `${Number(n).toLocaleString("uk-UA")} грн`;

const safe = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

let products = structuredClone(DEFAULT_PRODUCTS);

let cart = JSON.parse(
  localStorage.getItem("sushimir-cart") || "{}"
);

let activeCategory = "Усі";
let adminPasswordForApi = "";
let lastCatalogSnapshot = "";

let productSaving = false;
let imageLoading = false;
let catalogVersion = 0;
let catalogReady = false;

window._selectedProductImage = "";




async function saveProducts() {

  try {

    const response = await fetch(
      "/.netlify/functions/catalog",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPasswordForApi
        },

        body: JSON.stringify({ products })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Помилка збереження каталогу"
      );
    }

    if (Array.isArray(data.products)) {
      products = data.products;
    }

    lastCatalogSnapshot = JSON.stringify(products);
    catalogVersion++;

    return true;

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Не вдалося зберегти каталог"
    );

    return false;

  }

}




async function syncProducts(showErrors = false) {

  if (productSaving) return false;

  const requestVersion = catalogVersion;

  try {

    const response = await fetch(
      "/.netlify/functions/catalog",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {

      throw new Error(
        response.status === 404
          ? "Функція каталогу не опублікована на Netlify"
          : "Не вдалося завантажити меню"
      );

    }

    const data = await response.json();

    if (
      productSaving ||
      requestVersion !== catalogVersion
    ) {
      return false;
    }

    if (!Array.isArray(data.products)) {
      throw new Error("Некоректний каталог");
    }

    catalogReady = true;

    const snapshot = JSON.stringify(data.products);

    if (snapshot !== lastCatalogSnapshot) {

      products = data.products;

      lastCatalogSnapshot = snapshot;

      renderCategories();
      renderProducts();
      renderCart();

      if (
        $("#adminPanel") &&
        !$("#adminPanel").hidden
      ) {
        renderAdmin();
      }

    }

    return true;

  } catch (error) {

    console.error(error);

    if (showErrors) {
      toast(error.message);
    }

    return false;

  }

}




function saveCart() {

  localStorage.setItem(
    "sushimir-cart",
    JSON.stringify(cart)
  );

}

function toast(msg) {

  const el = $("#toast");

  el.textContent = msg;
  el.classList.add("show");

  clearTimeout(toast.t);

  toast.t = setTimeout(() => {
    el.classList.remove("show");
  }, 2600);

}




function renderCategories() {

  const cats = [
    "Усі",
    ...new Set(products.map(p => p.category))
  ];

  if (!cats.includes(activeCategory)) {
    activeCategory = "Усі";
  }

  $("#categories").innerHTML = cats.map(c => `

    <button
      class="category-btn ${
        c === activeCategory ? "active" : ""
      }"
      data-category="${safe(c)}"
    >
      ${safe(c)}
    </button>

  `).join("");

}




function renderProducts() {

  const list = products.filter(p =>
    activeCategory === "Усі" ||
    p.category === activeCategory
  );

  $("#productGrid").innerHTML = list.length
    ? list.map(p => `

      <article class="product-card">

        <div class="product-photo">

          <img
            loading="lazy"
            src="${safe(p.image)}"
            alt="${safe(p.name)}"
            onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=700'"
          >

          <span class="product-category">
            ${safe(p.category)}
          </span>

        </div>

        <div class="product-info">

          <h3>${safe(p.name)}</h3>

          <p>${safe(p.description)}</p>

          <div class="product-meta">

            <span>⚖ ${Number(p.weight)} г</span>

            <span>Свіже приготування</span>

          </div>

          <div class="product-buy">

            <strong>${money(p.price)}</strong>

            <button
              class="add-btn"
              data-add="${safe(p.id)}"
            >
              + В кошик
            </button>

          </div>

        </div>

      </article>

    `).join("")

    : `
      <p class="empty-cart">
        У цій категорії поки немає товарів.
      </p>
    `;

}




function validCartRows() {

  return Object.entries(cart).filter(
    ([id, q]) =>
      Number(q) > 0 &&
      products.some(p => p.id === id)
  );

}

function cartCount() {

  return validCartRows().reduce(
    (sum, [, q]) => sum + Number(q),
    0
  );

}

function cartTotal() {

  return validCartRows().reduce(
    (sum, [id, q]) => {

      const product = products.find(
        p => p.id === id
      );

      return sum +
        Number(product.price) * Number(q);

    },
    0
  );

}




function renderCart() {

  const rows = validCartRows();

  $("#cartCount").textContent = cartCount();

  $("#cartTotal").textContent = money(
    cartTotal()
  );

  $("#checkoutTotal").textContent = money(
    cartTotal()
  );

  $("#cartItems").innerHTML = rows.length

    ? rows.map(([id, q]) => {

      const p = products.find(
        x => x.id === id
      );

      return `

        <div class="cart-row">

          <img
            src="${safe(p.image)}"
            alt="${safe(p.name)}"
          >

          <div>

            <h4>${safe(p.name)}</h4>

            <small>
              ${money(p.price)} ·
              ${Number(p.weight)} г
            </small>

            <div class="quantity">

              <button
                data-qty="${safe(id)}"
                data-delta="-1"
              >
                −
              </button>

              <b>${Number(q)}</b>

              <button
                data-qty="${safe(id)}"
                data-delta="1"
              >
                +
              </button>

            </div>

          </div>

          <button
            class="remove-btn"
            data-remove="${safe(id)}"
            aria-label="Видалити"
          >
            ×
          </button>

        </div>

      `;

    }).join("")

    : `

      <div class="empty-cart">

        🍣

        <br><br>

        Ваш кошик поки порожній.

        <br>

        Саме час обрати щось смачненьке!

      </div>

    `;

  $("#checkoutBtn").disabled = !rows.length;

}




function addToCart(id) {

  if (!products.some(p => p.id === id)) {
    return;
  }

  cart[id] = Number(cart[id] || 0) + 1;

  saveCart();
  renderCart();

  toast("Додано до кошика 🍣");

}




function openOverlay(id) {

  $("#" + id).classList.add("open");

  $("#" + id).setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.style.overflow = "hidden";

}

function closeOverlay(id) {

  $("#" + id).classList.remove("open");

  $("#" + id).setAttribute(
    "aria-hidden",
    "true"
  );

  if (!document.querySelector(".overlay.open")) {
    document.body.style.overflow = "";
  }

}




document.addEventListener("click", e => {

  const add = e.target.closest("[data-add]");

  if (add) {
    addToCart(add.dataset.add);
  }

  const cat = e.target.closest("[data-category]");

  if (cat) {

    activeCategory = cat.dataset.category;

    renderCategories();
    renderProducts();

  }

  const qty = e.target.closest("[data-qty]");

  if (qty) {

    const id = qty.dataset.qty;

    cart[id] = Math.max(
      0,
      Number(cart[id] || 0) +
      Number(qty.dataset.delta)
    );

    if (!cart[id]) {
      delete cart[id];
    }

    saveCart();
    renderCart();

  }

  const rem = e.target.closest("[data-remove]");

  if (rem) {

    delete cart[rem.dataset.remove];

    saveCart();
    renderCart();

  }

  const close = e.target.closest("[data-close]");

  if (close) {
    closeOverlay(close.dataset.close);
  }

  if (e.target.classList.contains("overlay")) {
    closeOverlay(e.target.id);
  }

});



$("#openCart").onclick = () => {

  renderCart();
  openOverlay("cartOverlay");

};

$("#checkoutBtn").onclick = () => {

  closeOverlay("cartOverlay");

  renderCart();

  openOverlay("checkoutOverlay");

};

$("#themeToggle").onclick = () => {

  document.body.classList.toggle("dark");

  localStorage.setItem(
    "sushimir-theme",
    document.body.classList.contains("dark")
      ? "dark"
      : "light"
  );

};

if (
  localStorage.getItem("sushimir-theme") === "dark"
) {
  document.body.classList.add("dark");
}

$("#mobileMenu").onclick = () => {

  $(".main-nav").classList.toggle("show");

};

$(".main-nav").addEventListener("click", () => {

  $(".main-nav").classList.remove("show");

});

$("#year").textContent = new Date().getFullYear();




const phone = $("#phone");

phone.addEventListener("input", () => {

  let d = phone.value.replace(/\D/g, "");

  if (d.startsWith("380")) {
    d = d.slice(3);
  }

  if (d.startsWith("0")) {
    d = d.slice(1);
  }

  d = d.slice(0, 9);

  phone.value =
    "+380" +

    (d.length
      ? " " + d.slice(0, 2)
      : "") +

    (d.length > 2
      ? " " + d.slice(2, 5)
      : "") +

    (d.length > 5
      ? " " + d.slice(5, 7)
      : "") +

    (d.length > 7
      ? " " + d.slice(7, 9)
      : "");

});



$("#checkoutForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    const form = e.currentTarget;

    if (!cartCount()) {
      return toast("Кошик порожній");
    }

    const f = new FormData(form);

    const phoneValue = String(
      f.get("phone") || ""
    ).replace(/\s/g, "");

    if (!/^\+380\d{9}$/.test(phoneValue)) {

      return toast(
        "Перевірте номер телефону"
      );

    }

    const items = validCartRows().map(
      ([id, quantity]) => {

        const p = products.find(
          x => x.id === id
        );

        return {
          name: p.name,
          quantity: Number(quantity),
          price: Number(p.price),
          weight: Number(p.weight)
        };

      }
    );

    const order = {

      name: String(
        f.get("name") || ""
      ).trim(),

      phone: phoneValue,

      telegram: String(
        f.get("telegram") || ""
      ).trim() || "Не вказано",

      fulfillment: f.get("fulfillment"),

      orderTime:
        f.get("orderTime") ||
        "Якомога швидше",

      comment: String(
        f.get("comment") || ""
      ).trim() || "Немає",

      items,

      total: cartTotal()

    };


  

    let text =
      `📦 <b>НОВЕ ЗАМОВЛЕННЯ Sushi Mir</b>\n\n`;

    text +=
      `👤 <b>Ім'я:</b> ${safe(order.name)}\n`;

    text +=
      `📞 <b>Телефон:</b> ${safe(order.phone)}\n`;

    text +=
      `💬 <b>Telegram:</b> ${safe(order.telegram)}\n`;

    text +=
      `📍 <b>Спосіб:</b> ${safe(order.fulfillment)}\n`;

    text +=
      `🕒 <b>Час:</b> ${safe(order.orderTime)}\n`;

    text +=
      `📝 <b>Коментар:</b> ${safe(order.comment)}\n\n`;

    text +=
      `🛒 <b>Склад замовлення:</b>\n`;

    order.items.forEach(i => {

      text +=
        `• ${safe(i.name)} x${i.quantity} — ${money(
          i.price * i.quantity
        )}\n`;

    });

    text +=
      `\n💰 <b>Всього до сплати:</b> ${money(
        order.total
      )}`;


    const btn = $("#submitOrder");

    btn.disabled = true;
    btn.textContent = "Надсилаємо…";

    try {

      const response = await fetch(

        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,

        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({

            chat_id: CHAT_ID,

            text: text,

            parse_mode: "HTML"

          })
        }

      );

      const data = await response.json();

      if (!response.ok || !data.ok) {

        throw new Error(
          data.description ||
          "Помилка Telegram"
        );

      }

      cart = {};

      saveCart();
      renderCart();

      form.reset();

      closeOverlay("checkoutOverlay");

      $("#checkoutMessage").textContent =
        "Ваші дані будуть передані для обробки замовлення.";

      toast("Замовлення прийнято! Дякуємо 💚");

    } catch (err) {

      console.error(err);

      $("#checkoutMessage").textContent =
        "Не вдалося надіслати замовлення. Спробуйте ще раз.";

      toast("Помилка надсилання замовлення");

    } finally {

      btn.disabled = false;

      btn.innerHTML =
        'Підтвердити замовлення <span>→</span>';

    }

  }
);




$("#openAdmin").onclick = () => {

  openOverlay("adminOverlay");

  $("#adminPassword").value = "";

  $("#adminLogin").hidden = false;

  $("#adminPanel").hidden = true;

  if (!productSaving && !imageLoading) {
    resetProductEditor();
  }

};

$("#loginAdmin").onclick = async () => {

  if (
    $("#adminPassword").value !== ADMIN_PASSWORD
  ) {
    return toast("Неправильний пароль");
  }

  adminPasswordForApi = $("#adminPassword").value;

  const loaded = await syncProducts(true);

  if (!loaded) {
    return;
  }

  $("#adminLogin").hidden = true;

  $("#adminPanel").hidden = false;

  renderAdmin();

  toast("Вхід виконано");

};

$("#adminPassword").addEventListener(
  "keydown",
  e => {

    if (e.key === "Enter") {
      $("#loginAdmin").click();
    }

  }
);




function renderAdmin() {

  $("#adminProducts").innerHTML =

    products.map(p => `

      <div class="admin-product">

        <span>

          <b>${safe(p.name)}</b>

          · ${money(p.price)}

        </span>

        <span>

          <button
            data-edit="${safe(p.id)}"
          >
            Редагувати
          </button>

          <button
            class="delete"
            data-delete="${safe(p.id)}"
          >
            Видалити
          </button>

        </span>

      </div>

    `).join("")

    || `

      <p class="tiny-note">
        Каталог порожній.
      </p>

    `;

}



function resetProductEditor() {

  const form = $("#productForm");

  form.reset();

  form.elements["id"].value = "";

  window._selectedProductImage = "";

  $("#productImageFile").value = "";

  $("#imagePreview").hidden = true;

  $("#imagePreview").removeAttribute("src");

}



function updateEditorState() {

  const busy = productSaving || imageLoading;

  $("#productForm")
    .querySelectorAll("input, select, textarea, button")
    .forEach(el => {
      el.disabled = busy;
    });

  $("#resetProducts").disabled = busy;

  $("#clearProducts").disabled = busy;

  $("#logoutAdmin").disabled = busy;

}




$("#productForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    if (productSaving || imageLoading) {
      return;
    }

    if (!catalogReady) {

      return toast(
        "Спочатку завантажте каталог"
      );

    }

  

    const form = e.currentTarget;

    const f = new FormData(form);

    const editingId = String(
      f.get("id") || ""
    ).trim();


    const id = editingId || (

      typeof crypto.randomUUID === "function"

        ? crypto.randomUUID()

        : "p" +
          Date.now() +
          Math.random().toString(36).slice(2)

    );

    const oldProduct = products.find(
      p => p.id === id
    );

    if (editingId && !oldProduct) {

      resetProductEditor();

      return toast(
        "Цей товар більше не існує"
      );

    }

    const product = {

      id: id,

      name: String(
        f.get("name") || ""
      ).trim(),

      category: f.get("category"),

      description: String(
        f.get("description") || ""
      ).trim(),

      price: Number(f.get("price")),

      weight: Number(f.get("weight")),

      image:
        window._selectedProductImage ||
        oldProduct?.image ||
        ""

    };


   

    if (!product.name) {
      return toast("Вкажіть назву товару");
    }

    if (
      !Number.isFinite(product.price) ||
      product.price <= 0
    ) {
      return toast("Вкажіть правильну ціну");
    }

    if (
      !Number.isFinite(product.weight) ||
      product.weight <= 0
    ) {
      return toast("Вкажіть правильну вагу");
    }

    if (!product.description) {
      return toast("Додайте опис товару");
    }


    const previous = structuredClone(products);

    const saveButton = form.querySelector(
      'button[type="submit"]'
    );

    productSaving = true;

    catalogVersion++;

    updateEditorState();

    saveButton.textContent = "Зберігаємо...";

    try {

      const index = products.findIndex(
        p => p.id === id
      );

      if (index >= 0) {

     

        products[index] = product;

      } else {

       

        products.push(product);

      }

      const saved = await saveProducts();

      if (!saved) {

        products = previous;

        return;

      }

      renderCategories();
      renderProducts();
      renderAdmin();
      renderCart();

    

      resetProductEditor();

      toast(

        editingId

          ? "Товар успішно оновлено!"

          : "Новий товар додано для всіх клієнтів!"

      );

    } catch (error) {

      products = previous;

      console.error(error);

      toast("Помилка збереження товару");

    } finally {

      productSaving = false;

      updateEditorState();

      saveButton.textContent = "Зберегти товар";

    }

  }
);




$("#adminProducts").addEventListener(
  "click",
  async e => {

    if (productSaving || imageLoading) {
      return;
    }

    const edit = e.target.closest("[data-edit]");

    const del = e.target.closest("[data-delete]");


  

    if (edit) {

      const product = products.find(
        p => p.id === edit.dataset.edit
      );

      if (!product) return;

      resetProductEditor();

      const form = $("#productForm");

      form.elements["id"].value =
        product.id;

      form.elements["name"].value =
        product.name;

      form.elements["category"].value =
        product.category;

      form.elements["description"].value =
        product.description;

      form.elements["price"].value =
        product.price;

      form.elements["weight"].value =
        product.weight;

      window._selectedProductImage =
        product.image || "";

  

      if (product.image) {

        $("#imagePreview").src =
          product.image;

        $("#imagePreview").hidden = false;

      }

      form.scrollIntoView({

        behavior: "smooth",

        block: "center"

      });

      toast("Редагування товару");

      return;

    }


  

    if (del) {

      const id = del.dataset.delete;

      if (!confirm(
        "Видалити цей товар для всіх клієнтів?"
      )) {
        return;
      }

      const previous = structuredClone(products);

      productSaving = true;

      catalogVersion++;

      updateEditorState();

      try {

        products = products.filter(
          p => p.id !== id
        );

        const saved = await saveProducts();

        if (!saved) {

          products = previous;

          return;

        }

        delete cart[id];

        saveCart();

        if (
          $("#productForm").elements["id"].value === id
        ) {

          resetProductEditor();

        }

        renderCategories();
        renderProducts();
        renderCart();
        renderAdmin();

        toast("Товар видалено для всіх клієнтів");

      } catch (error) {

        products = previous;

        console.error(error);

        toast("Не вдалося видалити товар");

      } finally {

        productSaving = false;

        updateEditorState();

      }

    }

  }
);




$("#productImageFile").addEventListener(
  "change",
  async e => {

    if (productSaving || imageLoading) {
      return;
    }

    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {

      e.target.value = "";

      return toast("Оберіть файл зображення");

    }

    if (file.size > 12 * 1024 * 1024) {

      e.target.value = "";

      return toast("Фото має бути менше 12 МБ");

    }

    imageLoading = true;

    updateEditorState();

    const saveButton = $("#productForm")
      .querySelector('button[type="submit"]');

    saveButton.textContent = "Обробляємо фото...";

    try {

    

      const dataUrl = await new Promise(
        (resolve, reject) => {

          const reader = new FileReader();

          reader.onload = () => {
            resolve(reader.result);
          };

          reader.onerror = reject;

          reader.readAsDataURL(file);

        }
      );


  

      const img = await new Promise(
        (resolve, reject) => {

          const image = new Image();

          image.onload = () => {
            resolve(image);
          };

          image.onerror = reject;

          image.src = dataUrl;

        }
      );


    

      const maxSize = 800;

      const scale = Math.min(

        1,

        maxSize /
        Math.max(img.width, img.height)

      );

      const canvas = document.createElement("canvas");

      canvas.width = Math.max(
        1,
        Math.round(img.width * scale)
      );

      canvas.height = Math.max(
        1,
        Math.round(img.height * scale)
      );

      const ctx = canvas.getContext("2d");


     

      ctx.fillStyle = "#ffffff";

      ctx.fillRect(

        0,

        0,

        canvas.width,

        canvas.height

      );

      ctx.drawImage(

        img,

        0,

        0,

        canvas.width,

        canvas.height

      );


      

      const compressedImage = canvas.toDataURL(

        "image/jpeg",

        0.75

      );

      window._selectedProductImage =
        compressedImage;


   

      $("#imagePreview").src =
        compressedImage;

      $("#imagePreview").hidden = false;

      toast(
        "Фото готове — натисніть «Зберегти товар»"
      );

    } catch (error) {

      console.error(error);

      $("#productImageFile").value = "";

      toast("Не вдалося завантажити фото");

    } finally {

      imageLoading = false;

      updateEditorState();

      saveButton.textContent = "Зберегти товар";

    }

  }
);




$("#resetProductForm").onclick = () => {

  if (productSaving || imageLoading) {
    return;
  }

  resetProductEditor();

  toast("Форму очищено");

};




$("#resetProducts").onclick = async () => {

  if (productSaving || imageLoading) {
    return;
  }

  if (!confirm(
    "Скинути каталог до стандартного для всіх клієнтів?"
  )) {
    return;
  }

  const previous = structuredClone(products);

  productSaving = true;

  catalogVersion++;

  updateEditorState();

  try {

    products = structuredClone(DEFAULT_PRODUCTS);

    if (await saveProducts()) {

      resetProductEditor();

      renderCategories();
      renderProducts();
      renderAdmin();
      renderCart();

      toast("Каталог скинуто");

    } else {

      products = previous;

    }

  } finally {

    productSaving = false;

    updateEditorState();

  }

};




$("#clearProducts").onclick = async () => {

  if (productSaving || imageLoading) {
    return;
  }

  if (!confirm(
    "Видалити всі товари для всіх клієнтів?"
  )) {
    return;
  }

  const previous = structuredClone(products);

  productSaving = true;

  catalogVersion++;

  updateEditorState();

  try {

    products = [];

    if (await saveProducts()) {

      cart = {};

      saveCart();

      resetProductEditor();

      renderCategories();
      renderProducts();
      renderCart();
      renderAdmin();

      toast("Каталог очищено для всіх клієнтів");

    } else {

      products = previous;

    }

  } finally {

    productSaving = false;

    updateEditorState();

  }

};




$("#logoutAdmin").onclick = () => {

  if (productSaving || imageLoading) {
    return;
  }

  resetProductEditor();

  $("#adminPanel").hidden = true;

  $("#adminLogin").hidden = false;

  $("#adminPassword").value = "";

  adminPasswordForApi = "";

  toast("Ви вийшли з адмін-панелі");

};




renderCategories();

renderProducts();

renderCart();

syncProducts(true);




setInterval(() => {

  syncProducts();

}, 15000);
