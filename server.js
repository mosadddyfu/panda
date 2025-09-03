// 1. تحميل متغيرات البيئة
require('dotenv').config(); // يمكن حذفه إذا كنت تستخدم Render وتضبط المتغيرات هناك

// 2. استيراد المكتبات
const { Client } = require('pg');
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const FormData = require('form-data');
const upload = require('./upload');

// 3. إنشاء تطبيق Express
const app = express();
// Base URL for web pages opened from Telegram buttons (configurable)
const WEB_BASE = process.env.WEB_BASE || 'https://pandastore-f2yn.onrender.com';

// 4. إعداد الاتصال بقاعدة البيانات
const pgClient = new Client({
  connectionString: 'postgresql://data_k7hh_user:a4rANFLml8luQBejgZ7nq4mDj2wvWWeT@dpg-d259o063jp1c73d43is0-a.oregon-postgres.render.com/data_k7hh',
  ssl: { rejectUnauthorized: false }
});

// الاتصال بقاعدة البيانات لمرة واحدة فقط
pgClient.connect()
  .then(() => console.log("✅ تم الاتصال بقاعدة بيانات PostgreSQL بنجاح"))
  .catch(err => console.error('❌ فشل الاتصال بقاعدة PostgreSQL:', err));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = [process.env.ADMIN_ID, process.env.SECOND_ADMIN_ID].filter(Boolean);
const CHANNEL_ID = process.env.CHANNEL_ID;
const BOT_USERNAME = process.env.BOT_USERNAME || 'PandaStores_bot';

// التأكد من وجود جميع الجداول المطلوبة
(async () => {
  try {
    // جدول الاحالات
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        user_id BIGINT PRIMARY KEY,
        username VARCHAR(255),
        phone_number VARCHAR(20),
        referral_code VARCHAR(10) UNIQUE,
        invited_by VARCHAR(10),
        stars INTEGER DEFAULT 0,
        verified BOOLEAN DEFAULT false,
        verification_emojis VARCHAR(100),
        verification_message_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // جدول الطلبات
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        stars INTEGER,
        amount_ton VARCHAR(50) NOT NULL,
        amount_usd VARCHAR(50) NOT NULL,
        type VARCHAR(10) CHECK (type IN ('stars', 'premium')) DEFAULT 'stars',
        premium_months INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        completed BOOLEAN DEFAULT false
      );
    `);

    // جدول عمولات الإحالة (محفظة مرجع + عدد النجوم + العمولة بالدولار + حالة الدفع)
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS affiliate_commissions (
        id SERIAL PRIMARY KEY,
        ref_wallet VARCHAR(128) NOT NULL,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        stars INTEGER NOT NULL,
        commission_usd NUMERIC(12,6) NOT NULL,
        paid BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // إضافة عمود ref_code إذا لم يكن موجودًا لدعم الإحالات عبر البوت
    await pgClient.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='affiliate_commissions' AND column_name='ref_code'
        ) THEN
          ALTER TABLE affiliate_commissions ADD COLUMN ref_code VARCHAR(32);
        END IF;
      END$$;
    `);

    console.log("✅ تم التأكد من وجود جميع الجداول في قاعدة البيانات");
  } catch (err) {
    console.error("❌ خطأ في إنشاء/تعديل الجداول:", err);
  }
})();

const allowedOrigins = [
  'https://pandastores.netlify.app',
  'https://panda-stores-mu.vercel.app',
  'https://pandastore-f2yn.onrender.com'
];
// Ensure current server base is also allowed for CORS
if (WEB_BASE && !allowedOrigins.includes(WEB_BASE)) allowedOrigins.push(WEB_BASE);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', true);
  next();
});

// وظائف مساعدة
function isWorkingHours() {
  const now = new Date();
  const options = {
    timeZone: 'Africa/Cairo',
    hour: 'numeric',
    hour12: false
  };
  const hour = parseInt(new Intl.DateTimeFormat('en-GB', options).format(now));
  return hour >= 8 && hour < 24;
}

function generateRandomEmojis(count) {
  const emojis = ['😀', '😎', '🐼', '🚀', '⭐', '💰', '🎯', '🦁', '🐶', '🍎', '🍕', '⚽'];
  const selected = [];
  while (selected.length < count) {
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    if (!selected.includes(randomEmoji)) {
      selected.push(randomEmoji);
    }
  }
  return selected;
}

async function isUserSubscribed(chatId) {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getChatMember`, {
      params: {
        chat_id: `@${CHANNEL_ID.replace('@', '')}`,
        user_id: chatId
      }
    });
    return ['member', 'administrator', 'creator'].includes(response.data.result.status);
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
}

async function generateReferralCode(userId) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  try {
    await pgClient.query('UPDATE referrals SET referral_code = $1 WHERE user_id = $2', [code, userId]);
    return code;
  } catch (err) {
    console.error("Error generating referral code:", err);
    return null;
  }
}

async function addStarsToReferrer(userId, starsToAdd) {
  try {
    const referrerResult = await pgClient.query(
      'SELECT invited_by FROM referrals WHERE user_id = $1',
      [userId]
    );

    if (referrerResult.rows.length > 0 && referrerResult.rows[0].invited_by) {
      const referralCode = referrerResult.rows[0].invited_by;
      await pgClient.query(
        'UPDATE referrals SET stars = stars + $1 WHERE referral_code = $2 AND verified = true',
        [starsToAdd, referralCode]
      );
    }
  } catch (err) {
    console.error("Error adding stars to referrer:", err);
  }
}

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static('public'));

// ==============================================
// نقاط النهاية
// ==============================================

// نقاط نهاية الدفع البديل للبريميوم والنجوم
app.post('/premium-alt', upload.single('proof'), async (req, res) => {
  try {
    const { username, months, amountEgp, method, refNumber } = req.body;
    const file = req.file;
    if (!username || !months || !amountEgp || !method || !file) {
      return res.status(400).send('❌ بيانات الطلب غير مكتملة');
    }
    for (let adminId of ADMIN_IDS) {
      const caption = `طلب بريميوم (دفع بديل)\n👤 @${username}\n📅 شهور: ${months}\n💵 المبلغ بالجنيه: ${amountEgp}\n💳 الطريقة: ${method === 'vodafone' ? 'فودافون كاش' : 'InstaPay'}\nرقم الطلب: ${refNumber}`;
      const formData = new FormData();
      formData.append('chat_id', adminId);
      formData.append('caption', caption);
      formData.append('photo', file.buffer, { filename: file.originalname });
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, formData, {headers:formData.getHeaders()});
    }
    res.status(200).send('✅ تم استلام الطلب وسيتم مراجعته');
  } catch (e) {
    console.error('Error in /premium-alt:', e);
    res.status(500).send('❌ حدث خطأ أثناء معالجة الطلب');
  }
});

app.post('/order-alt', upload.single('proof'), async (req, res) => {
  try {
    const { username, stars, amountEgp, method, refNumber } = req.body;
    const file = req.file;
    if (!username || !stars || !amountEgp || !method || !file) {
      return res.status(400).send('❌ بيانات الطلب غير مكتملة');
    }
    for (let adminId of ADMIN_IDS) {
      const caption = `طلب نجوم (دفع بديل)\n👤 @${username}\n⭐️ نجوم: ${stars}\n💵 المبلغ بالجنيه: ${amountEgp}\n💳 الطريقة: ${method === 'vodafone' ? 'فودافون كاش' : 'InstaPay'}\nرقم الطلب: ${refNumber}`;
      const formData = new FormData();
      formData.append('chat_id', adminId);
      formData.append('caption', caption);
      formData.append('photo', file.buffer, { filename: file.originalname });
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, formData, {headers:formData.getHeaders()});
    }
    res.status(200).send('✅ تم استلام الطلب وسيتم مراجعته');
  } catch (e) {
    console.error('Error in /order-alt:', e);
    res.status(500).send('❌ حدث خطأ أثناء معالجة الطلب');
  }
});

app.post('/order', async (req, res) => {
  try {
    const { username, stars, amountTon, amountUsd, createdAt, refWallet, tgId } = req.body;

    if (!username || !stars || !amountTon || !amountUsd) {
      return res.status(400).send('❌ بيانات الطلب غير مكتملة');
    }

    const orderCreatedAt = createdAt || new Date().toISOString();
    const formattedDate = new Date(orderCreatedAt).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: 'Africa/Cairo',
    });

    const result = await pgClient.query(
      `INSERT INTO orders (username, stars, amount_ton, amount_usd, type, created_at)
       VALUES ($1, $2, $3, $4, 'stars', $5) RETURNING id`,
      [username, stars, amountTon, amountUsd, orderCreatedAt]
    );

    const orderId = result.rows[0].id;
    const fragmentStars = "https://fragment.com/stars/buy";

    // حساب عمولة الإحالة: أولوية لنظام البوت (ref_code) إذا كان الطلب مفتوح من داخل البوت
    try {
      const starsInt = parseInt(stars, 10) || 0;
      if (tgId) {
        // استخدم رمز الدعوة لمن دعا هذا المستخدم
        const { rows } = await pgClient.query('SELECT invited_by FROM referrals WHERE user_id = $1', [tgId]);
        const invitedBy = rows[0]?.invited_by;
        if (invitedBy) {
          const profitPerStar = 0.0157 - 0.015; // 0.0007 USD
          const commissionUsd = (starsInt * profitPerStar * 0.10); // 10%
          await pgClient.query(
            `INSERT INTO affiliate_commissions (ref_wallet, ref_code, order_id, stars, commission_usd)
             VALUES ($1, $2, $3, $4, $5)`,
            ['BOT_REF', invitedBy, orderId, starsInt, commissionUsd]
          );
        }
      } else if (refWallet && typeof refWallet === 'string' && refWallet.trim().length > 10) {
        // توافق خلفي: عمولة عبر رابط محفظة قديم
        const profitPerStar = 0.0157 - 0.015; // 0.0007 USD
        const commissionUsd = (starsInt * profitPerStar * 0.10); // 10%
        await pgClient.query(
          `INSERT INTO affiliate_commissions (ref_wallet, order_id, stars, commission_usd)
           VALUES ($1, $2, $3, $4)`,
          [refWallet.trim(), orderId, starsInt, commissionUsd]
        );
      }
    } catch (affErr) {
      console.error('Failed to record affiliate commission:', affErr);
    }

    for (let adminId of ADMIN_IDS) {
      try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: adminId,
          text: `New Order 🛒\n👤 Username: @${username}\n⭐️ Stars: ${stars}\n💰 TON: ${amountTon} TON\n💵 USDT: ${amountUsd} USDT\n📅 Order Date: ${formattedDate}`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔗 تنفيذ الطلب للمستخدم", web_app: { url: fragmentStars } }
              ],
              [
                { text: "🛩 تحديث الطلب فى قاعده البيانات", callback_data: `complete_${orderId}` }
              ]
            ]
          }
        });
      } catch (error) {
        console.error(`Failed to send notification to admin ${adminId}:`, error);
      }
    }

    res.status(200).send('✅ تم استلام طلبك بنجاح!');
  } catch (error) {
    console.error('Error in /order endpoint:', error);
    res.status(500).send('❌ حدث خطأ أثناء معالجة الطلب');
  }
});

// ملخص الإحالات حسب المحفظة
app.get('/affiliate/summary', async (req, res) => {
  try {
    const wallet = (req.query.wallet || '').toString().trim();
    const tgId = req.query.tg_id ? parseInt(req.query.tg_id, 10) : null;
    if (!wallet && !tgId) return res.status(400).json({ error: 'wallet or tg_id is required' });

    let rows;
    if (tgId) {
      // اجلب رمز إحالة صاحب الحساب ثم لخص العمولات عليه
      const { rows: r } = await pgClient.query('SELECT referral_code FROM referrals WHERE user_id = $1', [tgId]);
      const code = r[0]?.referral_code;
      if (!code) return res.json({ wallet: null, code: null, unpaid_usd: 0, total_usd: 0, total_stars: 0, total_orders: 0 });
      ({ rows } = await pgClient.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN paid = false THEN commission_usd END), 0) AS unpaid_usd,
           COALESCE(SUM(commission_usd), 0) AS total_usd,
           COALESCE(SUM(stars), 0) AS total_stars,
           COUNT(*) AS total_orders
         FROM affiliate_commissions
         WHERE ref_code = $1`,
        [code]
      ));
      return res.json({ code, unpaid_usd: Number(rows[0].unpaid_usd), total_usd: Number(rows[0].total_usd), total_stars: Number(rows[0].total_stars), total_orders: Number(rows[0].total_orders) });
    } else {
      ({ rows } = await pgClient.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN paid = false THEN commission_usd END), 0) AS unpaid_usd,
           COALESCE(SUM(commission_usd), 0) AS total_usd,
           COALESCE(SUM(stars), 0) AS total_stars,
           COUNT(*) AS total_orders
         FROM affiliate_commissions
         WHERE ref_wallet = $1`,
        [wallet]
      ));
      return res.json({ wallet, unpaid_usd: Number(rows[0].unpaid_usd), total_usd: Number(rows[0].total_usd), total_stars: Number(rows[0].total_stars), total_orders: Number(rows[0].total_orders) });
    }
  } catch (err) {
    console.error('Error in /affiliate/summary:', err);
    res.status(500).json({ error: 'server error' });
  }
});

// رابط الإحالة الخاص بالمستخدم وعدد الإحالات الناجحة (المُتحققة)
app.get('/referral/my-link', async (req, res) => {
  try {
    const tgId = req.query.tg_id ? parseInt(req.query.tg_id, 10) : null;
    if (!tgId) return res.status(400).json({ error: 'tg_id is required' });

    let r = await pgClient.query('SELECT referral_code FROM referrals WHERE user_id = $1', [tgId]);
    let code = r.rows[0]?.referral_code;
    if (!code) {
      // أنشئ الرمز إن لم يوجد
      code = await generateReferralCode(tgId);
    }
    if (!code) return res.status(500).json({ error: 'failed to generate code' });

    const stats = await pgClient.query(
      'SELECT COUNT(*)::int AS cnt FROM referrals WHERE invited_by = $1 AND verified = true',
      [code]
    );
    const count = stats.rows[0]?.cnt || 0;
    const link = `https://t.me/${BOT_USERNAME}?startapp=${code}`;
    res.json({ code, link, count });
  } catch (err) {
    console.error('Error in /referral/my-link:', err);
    res.status(500).json({ error: 'server error' });
  }
});

// طلب سحب أرباح الإحالة: يرسل إشعارًا إلى الأدمن
app.post('/affiliate/withdraw', async (req, res) => {
  try {
    const { wallet, usd, stars, tg } = req.body || {};
    const amountUsd = Number(usd || 0);
    const amountStars = Number(stars || 0);
    if (!wallet && !tg) return res.status(400).json({ error: 'wallet or tg is required' });

    const msgLines = [
      'طلب سحب أرباح',
      wallet ? `المحفظة: ${wallet}` : 'المحفظة: غير متوفر',
      `الإجمالي: ${amountUsd.toFixed(4)}$`,
      `صافى بالنجوم (تقريبي): ${Math.floor(amountUsd / 0.0157)}⭐`,
    ];
    if (tg && typeof tg === 'object') {
      const u = tg;
      msgLines.push(`المستخدم: ${u.username ? '@' + u.username : (u.first_name || 'مستخدم')} (ID: ${u.id || 'N/A'})`);
    }
    const text = msgLines.join('\n');

    for (let adminId of ADMIN_IDS) {
      try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: adminId,
          text
        });
      } catch (err) {
        console.error('Failed to notify admin of withdraw:', err.response?.data || err.message);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error in /affiliate/withdraw:', err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/premium', async (req, res) => {
  try {
    const { username, months, amountTon, amountUsd } = req.body;

    if (!username || !months || !amountTon || !amountUsd) {
      return res.status(400).send('❌ بيانات الطلب غير مكتملة');
    }

    const orderCreatedAt = new Date().toISOString();
    const formattedDate = new Date(orderCreatedAt).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: 'Africa/Cairo',
    });

    const result = await pgClient.query(
      `INSERT INTO orders (username, amount_ton, amount_usd, type, premium_months, created_at)
       VALUES ($1, $2, $3, 'premium', $4, $5) RETURNING id`,
      [username, amountTon, amountUsd, months, orderCreatedAt]
    );

    const orderId = result.rows[0].id;
    const fragmentPremium = "https://fragment.com/premium/gift";

    for (let adminId of ADMIN_IDS) {
      try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: adminId,
          text: `New Premium Order 🛒\n👤 Username: @${username}\n📅 Months: ${months}\n💰 TON: ${amountTon} TON\n💵 USDT: ${amountUsd} USDT\n📅 Order Date: ${formattedDate}`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔗 تنفيذ الطلب للمستخدم", web_app: { url: fragmentPremium } }
              ],
              [
                { text: "🛩 تحديث الطلب فى قاعده البيانات", callback_data: `complete_${orderId}` }
              ]
            ]
          }
        });
      } catch (error) {
        console.error(`Failed to send notification to admin ${adminId}:`, error);
      }
    }

    res.status(200).send('✅ تم استلام طلبك بنجاح!');
  } catch (error) {
    console.error('Error in /premium endpoint:', error);
    res.status(500).send('❌ حدث خطأ أثناء معالجة الطلب');
  }
});

app.get('/admin', async (req, res) => {
  try {
    const result = await pgClient.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error in /admin endpoint:', error);
    res.status(500).send('❌ حدث خطأ أثناء جلب البيانات');
  }
});

app.get('/admin/stars', async (req, res) => {
  try {
    const result = await pgClient.query("SELECT * FROM orders WHERE type = 'stars' ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error('Error in /admin/stars endpoint:', error);
    res.status(500).send('❌ حدث خطأ أثناء جلب بيانات النجوم');
  }
});

app.get('/admin/premium', async (req, res) => {
  try {
    const result = await pgClient.query("SELECT * FROM orders WHERE type = 'premium' ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error('Error in /admin/premium endpoint:', error);
    res.status(500).send('❌ حدث خطأ أثناء جلب بيانات البريميوم');
  }
});

app.post('/complete-order/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    await pgClient.query('UPDATE orders SET completed = true WHERE id = $1', [orderId]);
    res.status(200).send('✅ تم تحديث حالة الطلب');
  } catch (error) {
    console.error('Error in /complete-order endpoint:', error);
    res.status(500).send('❌ حدث خطأ أثناء تحديث الطلب');
  }
});

app.post('/telegramWebhook', async (req, res) => {
  const body = req.body;

  // 1. التحقق من المستخدمين الروس
  if (body.message?.from?.language_code === 'ru') {
    const chatId = body.message.chat.id;
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: "⛔ عذرًا، لا نقدم الخدمة للمستخدمين من روسيا."
    });
    return res.sendStatus(200);
  }

  // 2. التحقق من الاشتراك في القناة
  if (body.callback_query?.data === "check_subscription") {
    const chatId = body.callback_query.from.id;
    const isSubscribed = await isUserSubscribed(chatId);

    if (isSubscribed) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "📱 يرجى مشاركة رقم هاتفك للمتابعة:",
        reply_markup: {
          keyboard: [[{ text: "مشاركة رقم الهاتف", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "❌ لم تشترك في القناة بعد. يرجى الاشتراك أولاً ثم اضغط على ✅ لقد اشتركت",
        reply_markup: {
          inline_keyboard: [
            [{ text: "انضم إلى القناة", url: `https://t.me/${CHANNEL_ID.replace('@', '')}` }],
            [{ text: "✅ لقد اشتركت", callback_data: "check_subscription" }]
          ]
        }
      });
    }
    return res.sendStatus(200);
  }

  if (body.message?.text === "/start" || body.message?.text === "/shop" || body.message?.text === "/invite") {
    const chatId = body.message.chat.id;
    const isSubscribed = await isUserSubscribed(chatId);
    if (!isSubscribed) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "📢 يرجى الاشتراك في قناتنا أولاً لتتمكن من استخدام البوت:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "انضم إلى القناة", url: `https://t.me/${CHANNEL_ID.replace('@', '')}` }],
            [{ text: "✅ لقد اشتركت", callback_data: "check_subscription" }]
          ]
        }
      });
      return res.sendStatus(200);
    }
  }

  // 3. التحقق من رقم الهاتف والايموجي
  if (body.message?.text === "/start") {
    const chatId = body.message.chat.id;
    const userResult = await pgClient.query('SELECT * FROM referrals WHERE user_id = $1', [chatId]);

    if (userResult.rows.length === 0) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "📱 يرجى مشاركة رقم هاتفك للمتابعة:",
        reply_markup: {
          keyboard: [[{ text: "مشاركة رقم الهاتف", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return res.sendStatus(200);
    } else if (!userResult.rows[0].verified) {
      if (!userResult.rows[0].verification_emojis) {
        const emojis = generateRandomEmojis(9);
        const targetEmoji = emojis[Math.floor(Math.random() * emojis.length)];

        await pgClient.query('UPDATE referrals SET verification_emojis = $1 WHERE user_id = $2',
          [emojis.join(','), chatId]);

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `🔐 للتحقق، يرجى الضغط على الايموجي: ${targetEmoji}`
        });

        const message = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "اختر الايموجي المطلوب:",
          reply_markup: {
            inline_keyboard: [
              emojis.slice(0, 3).map(e => ({ text: e, callback_data: `verify_${e}_${targetEmoji}` })),
              emojis.slice(3, 6).map(e => ({ text: e, callback_data: `verify_${e}_${targetEmoji}` })),
              emojis.slice(6, 9).map(e => ({ text: e, callback_data: `verify_${e}_${targetEmoji}` }))
            ]
          }
        });

        await pgClient.query('UPDATE referrals SET verification_message_id = $1 WHERE user_id = $2',
          [message.data.result.message_id, chatId]);
      }
      return res.sendStatus(200);
    }
  }

  // 4. معالجة التحقق بالايموجي
  if (body.callback_query?.data.startsWith('verify_')) {
    const [_, selectedEmoji, targetEmoji] = body.callback_query.data.split('_');
    const userId = body.callback_query.from.id;
    const messageId = body.callback_query.message.message_id;

    if (selectedEmoji === targetEmoji) {
      await pgClient.query('UPDATE referrals SET verified = true, verification_emojis = NULL WHERE user_id = $1', [userId]);

      // إضافة النجوم للمدعو
      await pgClient.query('UPDATE referrals SET stars = stars + 1 WHERE user_id = $1', [userId]);

      // إضافة النجوم للمدعِي إذا كان موجوداً
      await addStarsToReferrer(userId, 1);

      try {
        const userResult = await pgClient.query('SELECT verification_message_id FROM referrals WHERE user_id = $1', [userId]);
        const verificationMessageId = userResult.rows[0]?.verification_message_id;

        if (verificationMessageId) {
          try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
              chat_id: userId,
              message_id: verificationMessageId
            });
          } catch (deleteErr) {
            if (deleteErr.response?.data?.description !== 'Bad Request: message to delete not found') {
              console.error("Error deleting verification message:", deleteErr);
            }
          }
        }

        try {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
            chat_id: userId,
            message_id: messageId
          });
        } catch (deleteErr) {
          if (deleteErr.response?.data?.description !== 'Bad Request: message to delete not found') {
            console.error("Error deleting emoji message:", deleteErr);
          }
        }
      } catch (err) {
        console.error("Error during verification cleanup:", err);
      }

      const welcomeMessage = "✅ تم التحقق بنجاح! مرحبًا بك في Panda Store 🐼\nيمكنك شراء نجوم تليجرام من موقعنا الرسمى🚀\nارسل امر /invite لبدا الربح من البوت";
      const replyMarkup = {
        inline_keyboard: [
          [{ text: "تحقق من مواعيد العمل 🚀", callback_data: "check_order_time" }],
          [{ text: "انضمام الى قناه الاثباتات", url: "https://t.me/PandaStoreShop" }]
        ]
      };

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: welcomeMessage,
        reply_markup: replyMarkup
      });
    } else {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "❌ الايموجي الذي اخترته غير صحيح. يرجى المحاولة مرة أخرى."
      });
    }
    return res.sendStatus(200);
  }

  // 5. معالجة رقم الهاتف
  if (body.message?.contact) {
    const phone = body.message.contact.phone_number;
    const userId = body.message.from.id;
    const username = body.message.from.username || 'غير معروف';

    if (phone.startsWith('+7')) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "⛔ عذرًا، لا نقدم الخدمة للمستخدمين من روسيا."
      });
      return res.sendStatus(200);
    }

    try {
      const userExists = await pgClient.query('SELECT * FROM referrals WHERE user_id = $1', [userId]);

      if (userExists.rows.length > 0) {
        await pgClient.query(
          'UPDATE referrals SET phone_number = $1, username = $2 WHERE user_id = $3',
          [phone, username, userId]
        );
      } else {
        await pgClient.query(
          'INSERT INTO referrals (user_id, username, phone_number, verified) VALUES ($1, $2, $3, $4)',
          [userId, username, phone, false]
        );
      }

      const emojis = generateRandomEmojis(9);
      const targetEmoji = emojis[Math.floor(Math.random() * emojis.length)];

      await pgClient.query('UPDATE referrals SET verification_emojis = $1 WHERE user_id = $2',
        [emojis.join(','), userId]);

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: `🔐 شكرًا لمشاركة رقم هاتفك. للتحقق، يرجى الضغط على الايموجي: ${targetEmoji}`
      });

      const message = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "اختر الايموجي المطلوب:",
        reply_markup: {
          inline_keyboard: [
            emojis.slice(0, 3).map(e => ({ text: e, callback_data: `verify_${e}_${targetEmoji}` })),
            emojis.slice(3, 6).map(e => ({ text: e, callback_data: `verify_${e}_${targetEmoji}` })),
            emojis.slice(6, 9).map(e => ({ text: e, callback_data: `verify_${e}_${targetEmoji}` }))
          ]
        }
      });

      await pgClient.query('UPDATE referrals SET verification_message_id = $1 WHERE user_id = $2',
        [message.data.result.message_id, userId]);

    } catch (err) {
      console.error("Error processing phone number:", err);
    }
    return res.sendStatus(200);
  }

  // 6. معالجة رابط الإحالة
  if (body.message?.text?.startsWith('/start ')) {
    const referralCode = body.message.text.split(' ')[1];
    const userId = body.message.from.id;
    const username = body.message.from.username || 'غير معروف';

    try {
      const referrerResult = await pgClient.query(
        'SELECT * FROM referrals WHERE referral_code = $1',
        [referralCode]
      );

      if (referrerResult.rows.length > 0) {
        const userExists = await pgClient.query('SELECT * FROM referrals WHERE user_id = $1', [userId]);

        if (userExists.rows.length === 0) {
          await pgClient.query(
            'INSERT INTO referrals (user_id, username, invited_by) VALUES ($1, $2, $3)',
            [userId, username, referralCode]
          );
        } else {
          await pgClient.query(
            'UPDATE referrals SET invited_by = $1 WHERE user_id = $2',
            [referralCode, userId]
          );
        }
      }
    } catch (err) {
      console.error("Error processing referral:", err);
    }
    return res.sendStatus(200);
  }

  // 7. معالجة الأوامر الأخرى
  if (body.message?.text) {
    const chatId = body.message.chat.id;
    const text = body.message.text;

    if (text === "/shop") {
      const keyboard = {
        inline_keyboard: [
          [{ text: "⭐ شراء نجوم", web_app: { url: `${WEB_BASE}/buy-stars` } }],
          [{ text: "💎 شراء بريميوم", web_app: { url: `${WEB_BASE}/buy-premium` } }],
          [{ text: "📊 لوحة التحكم", web_app: { url: `${WEB_BASE}/dashboard` } }],
          [{ text: "📱 تحقق من مواعيد العمل 🚀", callback_data: "check_order_time" }]
        ]
      };

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "مرحبًا بك في Panda Store 🐼\nاختر ما تريد شراءه:",
        reply_markup: keyboard
      });
    } else if (text === "/invite") {
      const userResult = await pgClient.query('SELECT * FROM referrals WHERE user_id = $1', [chatId]);

      if (userResult.rows.length === 0 || !userResult.rows[0].verified) {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "❌ يجب عليك التحقق أولاً باستخدام رقم هاتفك. ارسل /start للبدء."
        });
        return res.sendStatus(200);
      }

      let referralCode = userResult.rows[0].referral_code;
      if (!referralCode) {
        referralCode = await generateReferralCode(chatId);
      }

      const referralLink = `https://t.me/${BOT_USERNAME}?startapp=${referralCode}`;
      const referralMessage = `🐼 Panda Store - برنامج الإحالة 🚀\n\n🔗 رابط الإحالة الخاص بك:\n${referralLink}\n\n📊 ستكسب 1 ⭐ لكل صديق تدعوه!`;

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: referralMessage,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 مشاركة الرابط", url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("انضم إلى Panda Store لشراء نجوم تليجرام! 🐼")}` }],
            [{ text: "📊 إحصائيات الإحالة", web_app: { url: `${WEB_BASE}/affiliate?tg_id=${chatId}` } }]
          ]
        }
      });
    }
  }

  // 8. معالجة التحقق من وقت العمل
  if (body.callback_query?.data === "check_order_time") {
    const chatId = body.callback_query.from.id;
    const working = isWorkingHours();

    if (working) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "✅ متاح للطلب الآن! يمكنك تقديم طلبك."
      });
    } else {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "⏰ خارج أوقات العمل حاليًا. أوقات العمل من 8 صباحًا حتى 12 منتصف الليل (توقيت القاهرة)."
      });
    }
  }

  // 9. معالجة تحديث حالة الطلب
  if (body.callback_query?.data.startsWith('complete_')) {
    const orderId = body.callback_query.data.split('_')[1];
    const chatId = body.callback_query.from.id;

    if (ADMIN_IDS.includes(chatId.toString())) {
      await pgClient.query('UPDATE orders SET completed = true WHERE id = $1', [orderId]);
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
        callback_query_id: body.callback_query.id,
        text: "✅ تم تحديث حالة الطلب"
      });
    } else {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
        callback_query_id: body.callback_query.id,
        text: "❌ ليس لديك صلاحية للقيام بهذا الإجراء"
      });
    }
  }

  res.sendStatus(200);
});

// 10. إعداد ويب هوك للبوت
app.get('/setWebhook', async (req, res) => {
  try {
    const webhookUrl = `${WEB_BASE}/telegramWebhook`;
    const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
    res.send(response.data);
  } catch (error) {
    console.error('Error setting webhook:', error);
    res.status(500).send('❌ فشل في إعداد الويب هوك');
  }
});

// 11. تشغيل الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
