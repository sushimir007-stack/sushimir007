
const { getStore, connectLambda } = require('@netlify/blobs');

const STORE_NAME = 'sushi-mir-catalog';
const CATALOG_KEY = 'products';

// Відповідь сервера
function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Content-Type, x-admin-password',
      'Access-Control-Allow-Methods':
        'GET, POST, OPTIONS'
    },
    body: statusCode === 204
      ? ''
      : JSON.stringify(payload)
  };
}

// Головна функція Netlify
exports.handler = async (event, context) => {

  if (event.httpMethod === 'OPTIONS') {
    return response(204, {});
  }

  try {

    // Підключення Netlify Blobs
    connectLambda(event);

    // Постійне сховище каталогу
    const store = getStore({
      name: STORE_NAME,
      consistency: 'eventual'
    });

    // ===================================
    // ЗАВАНТАЖЕННЯ КАТАЛОГУ
    // ===================================

    if (event.httpMethod === 'GET') {

      const products = await store.get(
        CATALOG_KEY,
        {
          type: 'json'
        }
      );

      // Якщо каталог ще не створений
      if (products === null) {
        return response(200, {
          products: []
        });
      }

      // Перевірка каталогу
      if (!Array.isArray(products)) {
        return response(500, {
          error: 'Некоректні дані каталогу'
        });
      }

      return response(200, {
        products: products
      });
    }

    // ===================================
    // ПЕРЕВІРКА МЕТОДУ
    // ===================================

    if (event.httpMethod !== 'POST') {
      return response(405, {
        error: 'Метод не підтримується'
      });
    }

    // ===================================
    // ПЕРЕВІРКА ПАРОЛЯ
    // ===================================

    const expectedPassword =
      process.env.ADMIN_PASSWORD;

    if (!expectedPassword) {
      return response(500, {
        error: 'ADMIN_PASSWORD не налаштовано в Netlify'
      });
    }

    const suppliedPassword =
      event.headers?.['x-admin-password'] ||
      event.headers?.['X-Admin-Password'] ||
      '';

    if (
      !suppliedPassword ||
      suppliedPassword !== expectedPassword
    ) {
      return response(401, {
        error: 'Неправильний пароль адміністратора'
      });
    }

    // ===================================
    // ОТРИМАННЯ ДАНИХ
    // ===================================

    let body;

    try {

      const rawBody = event.isBase64Encoded
        ? Buffer.from(
            event.body || '',
            'base64'
          ).toString('utf8')
        : event.body || '{}';

      body = JSON.parse(rawBody);

    } catch (error) {

      return response(400, {
        error: 'Некоректні дані запиту'
      });
    }

    if (
      !body ||
      !Array.isArray(body.products)
    ) {
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

    // ===================================
    // ПЕРЕВІРКА ТОВАРІВ
    // ===================================

    for (const item of body.products) {

      if (!item || typeof item !== 'object') {
        return response(400, {
          error: 'Некоректний товар у каталозі'
        });
      }

      const id = String(
        item.id || ''
      ).trim();

      const name = String(
        item.name || ''
      ).trim();

      const category = String(
        item.category || ''
      ).trim();

      const description = String(
        item.description || ''
      ).trim();

      const price = Number(item.price);
      const weight = Number(item.weight);

      const image = String(
        item.image || ''
      );

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
          error:
            'Перевірте назву, категорію, опис, ціну та вагу товару'
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

    // ===================================
    // ПЕРЕВІРКА РОЗМІРУ КАТАЛОГУ
    // ===================================

    const catalogSize = Buffer.byteLength(
      JSON.stringify(cleanProducts),
      'utf8'
    );

    if (catalogSize > 4 * 1024 * 1024) {

      return response(413, {
        error:
          'Каталог завеликий. Зменшіть розмір фотографій товарів.'
      });
    }

    // ===================================
    // ПОСТІЙНЕ ЗБЕРЕЖЕННЯ
    // ===================================

    await store.setJSON(
      CATALOG_KEY,
      cleanProducts
    );

    // Якщо запис успішний
    console.log(
      'SUSHI MIR: Каталог успішно збережено.',
      'Товарів:',
      cleanProducts.length,
      'Розмір:',
      catalogSize,
      'байтів'
    );

    return response(200, {
      ok: true,
      products: cleanProducts
    });

  } catch (error) {

    console.error(
      'SUSHI MIR: Catalog error:',
      error
    );

    return response(500, {
      error:
        'Не вдалося зберегти або завантажити каталог'
    });
  }
};
