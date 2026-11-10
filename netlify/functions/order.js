const https = require('https');

function sendTelegram(token, chatId, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(204, {});
  if (event.httpMethod !== 'POST') return response(405, { error: 'Метод не підтримується' });

  try {
    let order;
    try {
      order = JSON.parse(event.body || '{}');
    } catch {
      return response(400, { error: 'Некоректні дані замовлення' });
    }

    const token = process.env.BOT_TOKEN || "9233896450:AAFAxUkf9Dz4JqhGcR8YABtyJbKsr5Zk4Tc";
    const chatId = process.env.CHAT_ID || "1397770315";

    if (!order.name || !order.phone || !Array.isArray(order.items) || order.items.length === 0) {
      return response(400, { error: 'Неповні дані замовлення' });
    }

    let text = `📦 <b>НОВЕ ЗАМОВЛЕННЯ Sushi Mir</b>\n\n`;
    text += `👤 <b>Ім'я:</b> ${String(order.name).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}\n`;
    text += `📞 <b>Телефон:</b> ${String(order.phone).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}\n`;
    text += `💬 <b>Telegram:</b> ${String(order.telegram || 'Не вказано').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}\n`;
    text += `📍 <b>Спосіб:</b> ${String(order.fulfillment || 'Не вказано').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}\n`;
    text += `📝 <b>Коментар:</b> ${String(order.comment || 'Немає').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}\n\n`;
    text += `🛒 <b>Склад замовлення:</b>\n`;
    
    order.items.forEach(i => {
      const itemName = String(i.name || '').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
      const q = Number(i.quantity) || 1;
      const p = Number(i.price) || 0;
      text += `• ${itemName} x${q} — ${(q * p).toLocaleString("uk-UA")} грн\n`;
    });
    text += `\n💰 <b>Всього до сплати:</b> ${Number(order.total || 0).toLocaleString("uk-UA")} грн`;

    const result = await sendTelegram(token, chatId, text);
    if (!result.ok) throw new Error(result.description || 'Помилка Telegram API');

    return response(200, { ok: true });
  } catch (err) {
    console.error('Order function error:', err);
    return response(500, { error: err.message || 'Помилка надсилання замовлення' });
  }
};
