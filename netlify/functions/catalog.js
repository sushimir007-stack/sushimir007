
const { getStore, connectLambda } = require('@netlify/blobs');

const STORE_NAME = 'sushi-mir-catalog';
const CATALOG_KEY = 'products';

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async (event, context) => {

  if (event.httpMethod === 'OPTIONS') {
    return response(204, {});
  }

  try {

    // Підключення до постійного сховища Netlify
    connectLambda(event);

    const store = getStore({
      name: STORE_NAME,
      consistency: 'strong'
    });

    // ЗАВАНТАЖЕННЯ ТОВАРІВ

    if (event.httpMethod === 'GET') {

      const products = await store.get(
        CATALOG_KEY,
        { type: 'json' }
      );

      if (products === null) {
        return response(200, {
          products: []
        });
      }

      if (!Array.isArray(products)) {
        return response(500, {
          error: 'Некоректні дані каталогу'
        });
      }

      return response(200, {
        products: products
      });
    }

    // ПЕРЕВІРКА МЕТОДУ

    if (event.httpMethod !== 'POST') {
      return response(405, {
        error: 'Метод не підтримується'
      });
    }

    // ПЕРЕВІРКА ПАРОЛЯ

    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!expectedPassword) {
      return response(500, {
        error: 'ADMIN_PASSWORD не налаштовано в Netlify'
      });
    }

    const suppliedPassword =
      event.headers?.['x-admin-password'] ||
      event.headers?.['X-Admin-Password'] ||
      '';

    if (suppliedPassword !== expectedPassword) {
      return response(401, {
        error: 'Неправильний пароль адміністратора'
      });
    }

    // ОТРИМАННЯ ДАНИХ

    let body;

    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return response(400, {
        error: 'Некоректні дані запиту'
      });
    }

    if (!Array.isArray(body.products)) {
      return response(400, {
        error: 'Список товарів має бути масивом'
      });
    }

    if (body.products.length > 500) {
      return response(413, {
        error: 'Забагато товарів у каталозі'
      });
    }

    const cleanProducts = [];
    const ids = new Set();

    // ПЕРЕВІРКА ТОВАРІВ

    for (const item of body.products) {

      if (!item || typeof item !== 'object') {
        return response(400, {
          error: 'Некоректний товар у каталозі'
        });
      }

      const id = String(item.id || '').trim();
      const name = String(item.name || '').trim();
      const category = String(item.category || '').trim();
      const description = String(item.description || '').trim();
      const price = Number(item.price);
      const weight = Number(item.weight);
      const image = String(item.image || '');

      if (
        !id ||
        !name ||
        !category ||
        !description ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isFinite(weight) ||
        weight <= 0
      ) {
        return response(400, {
          error: 'Перевірте назву, категорію, опис, ціну та вагу товару'
        });
      }

      if (ids.has(id)) {
        return response(400, {
          error: 'Знайдено товари з однаковим ID'
        });
      }

      if (image.length > 5000000) {
        return response(413, {
          error: 'Зображення завелике'
        });
      }

      ids.add(id);

      cleanProducts.push({
        id,
        name,
        category,
        description,
        price,
        weight,
        image
      });
    }

    // ПОСТІЙНЕ ЗБЕРЕЖЕННЯ КАТАЛОГУ

    await store.setJSON(
      CATALOG_KEY,
      cleanProducts
    );

    // ПЕРЕВІРКА ЗБЕРЕЖЕННЯ

    const savedProducts = await store.get(
      CATALOG_KEY,
      { type: 'json' }
    );

    if (
      !Array.isArray(savedProducts) ||
      JSON.stringify(savedProducts) !==
      JSON.stringify(cleanProducts)
    ) {
      return response(500, {
        error: 'Не вдалося підтвердити збереження товарів'
      });
    }

    console.log(
      'Каталог успішно збережено. Товарів:',
      savedProducts.length
    );

    return response(200, {
      ok: true,
      products: savedProducts
    });

  } catch (error) {

    console.error('Catalog function error:', error);

    return response(500, {
      error: 'Не вдалося зберегти або завантажити каталог'
    });
  }
};
