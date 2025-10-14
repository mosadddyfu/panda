// 1. تحميل متغيرات البيئة
require('dotenv').config(); // يمكن حذفه إذا كنت تستخدم Render وتضبط المتغيرات هناك

// 2. استيراد المكتبات
const { Client } = require('pg');
const express = require('express');
const upload = require('./upload');
const app = express();
const pgClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_m0KeMp4lvAZq@ep-solitary-rain-aeooi348-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

// الاتصال بقاعدة البيانات لمرة واحدة فقط
pgClient.connect()
  .then(() => console.log("✅ تم الاتصال بقاعدة بيانات PostgreSQL بنجاح"))
  .catch(err => console.error('❌ فشل الاتصال بقاعدة PostgreSQL:', err));

const axios = require('axios');
const bodyParser = require('body-parser');
const FormData = require('form-data');




// 3. إنشاء تطبيق Express
// (تم نقل تعريف app للأعلى)

// نقاط نهاية الدفع البديل للبريميوم والنجوم

const fs = require('fs');
const path = require('path');
const PROOF_UPLOADS_DIR = path.join(__dirname, 'public', 'proof_uploads');
if (!fs.existsSync(PROOF_UPLOADS_DIR)) fs.mkdirSync(PROOF_UPLOADS_DIR, { recursive: true });

app.post('/premium-alt', upload.single('proof'), async (req, res) => {
  try {
    const { username, months, amountEgp, method, refNumber } = req.body;
    const file = req.file;
    if (!username || !months || !amountEgp || !method || !file) {
      return res.status(400).send('❌ بيانات الطلب غير مكتملة');
    }
    // حفظ الصورة
    const proofFilename = `${Date.now()}_${Math.floor(Math.random() * 1e6)}_${file.originalname}`;
    const proofPath = path.join(PROOF_UPLOADS_DIR, proofFilename);
    fs.writeFileSync(proofPath, file.buffer);
    // تخزين الطلب في قاعدة البيانات
    const result = await pgClient.query(
      `INSERT INTO orders (username, amount_ton, amount_usd, type, premium_months, created_at, completed, proof_url, alt_method, amount_egp, ref_number)
       VALUES ($1, $2, $3, 'premium', $4, NOW(), false, $5, $6, $7, $8) RETURNING id`,
      [username, null, null, months, `/proof_uploads/${proofFilename}`, method, amountEgp, refNumber]
    );
    // إشعار التليجرام كما كان
    for (let adminId of ADMIN_IDS) {
      const caption = `طلب بريميوم (دفع بديل)\n👤 @${username}\n📅 شهور: ${months}\n💵 المبلغ بالجنيه: ${amountEgp}\n💳 الطريقة: ${method === 'vodafone' ? 'فودافون كاش' : 'InstaPay'}\nرقم الطلب: ${refNumber}`;
      const formData = new FormData();
      formData.append('chat_id', adminId);
      formData.append('caption', caption);
      formData.append('photo', file.buffer, { filename: file.originalname });
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, formData, { headers: formData.getHeaders() });
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
    // حفظ الصورة
    const proofFilename = `${Date.now()}_${Math.floor(Math.random() * 1e6)}_${file.originalname}`;
    const proofPath = path.join(PROOF_UPLOADS_DIR, proofFilename);
    fs.writeFileSync(proofPath, file.buffer);
    // تخزين الطلب في قاعدة البيانات
    const result = await pgClient.query(
      `INSERT INTO orders (username, stars, type, created_at, completed, proof_url, alt_method, amount_egp, ref_number)
       VALUES ($1, $2, 'stars', NOW(), false, $3, $4, $5, $6) RETURNING id`,
      [username, stars, `/proof_uploads/${proofFilename}`, method, amountEgp, refNumber]
    );
    // إشعار التليجرام كما كان
    for (let adminId of ADMIN_IDS) {
      const caption = `طلب نجوم (دفع بديل)\n👤 @${username}\n⭐️ نجوم: ${stars}\n💵 المبلغ بالجنيه: ${amountEgp}\n💳 الطريقة: ${method === 'vodafone' ? 'فودافون كاش' : 'InstaPay'}\nرقم الطلب: ${refNumber}`;
      const formData = new FormData();
      formData.append('chat_id', adminId);
      formData.append('caption', caption);
      formData.append('photo', file.buffer, { filename: file.originalname });
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, formData, { headers: formData.getHeaders() });
    }
    res.status(200).send('✅ تم استلام الطلب وسيتم مراجعته');
  } catch (e) {
    console.error('Error in /order-alt:', e);
    res.status(500).send('❌ حدث خطأ أثناء معالجة الطلب');
  }
});

// 3. إنشاء تطبيق Express

// Base URL for web pages opened from Telegram buttons (configurable)
const WEB_BASE = process.env.WEB_BASE || 'https://panda-scz8.onrender.com';

// 4. إعداد الاتصال بقاعدة البيانات
// const pgClient = new Client({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false }
// });

// 5. الاتصال بقاعدة البيانا

// ... باقي الكود كما هو ...

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = [process.env.ADMIN_ID, process.env.SECOND_ADMIN_ID].filter(Boolean);
const CHANNEL_ID = process.env.CHANNEL_ID;
const BOT_USERNAME = process.env.BOT_USERNAME || 'PandaStores_bot';

// التأكد من وجود جميع الجداول المطلوبة
(async () => {
  // تعديل أعمدة amount_ton و amount_usd لتسمح بالقيم الفارغة (NULL) إذا كانت NOT NULL
  const nullableCols = ["amount_ton", "amount_usd"];
  for (const col of nullableCols) {
    await pgClient.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='${col}' AND is_nullable='NO'
          ) THEN
            EXECUTE 'ALTER TABLE orders ALTER COLUMN ${col} DROP NOT NULL';
          END IF;
        END$$;
      `);
  }
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

    // إضافة أعمدة جديدة لجدول الطلبات إذا لم تكن موجودة
    const alterOrderColumns = [
      { name: 'proof_url', type: 'VARCHAR(255)' },
      { name: 'alt_method', type: 'VARCHAR(32)' },
      { name: 'amount_egp', type: 'VARCHAR(32)' },
      { name: 'ref_number', type: 'VARCHAR(32)' }
    ];
    for (const col of alterOrderColumns) {
      await pgClient.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='${col.name}'
          ) THEN
            ALTER TABLE orders ADD COLUMN ${col.name} ${col.type};
          END IF;
        END$$;
      `);
    }

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
  'https://panda-scz8.onrender.com'
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
      console.error("Error saving phone number:", err);
    }
    return res.sendStatus(200);
  }

  // 6. معالجة الأمر /invite
  if (body.message?.text === "/invite") {
    const userId = body.message.from.id;
    const userResult = await pgClient.query('SELECT * FROM referrals WHERE user_id = $1', [userId]);

    if (userResult.rows.length === 0) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "❗ يرجى إكمال عملية التسجيل أولاً عن طريق إرسال /start"
      });
      return res.sendStatus(200);
    }

    const referralCode = userResult.rows[0].referral_code || await generateReferralCode(userId);
    const referralLink = `https://t.me/${BOT_USERNAME}?startapp=${referralCode}`;

    const statsResult = await pgClient.query(
      'SELECT COUNT(*) FROM referrals WHERE invited_by = $1 AND verified = true',
      [referralCode]
    );
    const referralCount = statsResult.rows[0].count;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: userId,
      text: `📣 رابط الدعوة الخاص بك:\n${referralLink}\n\n🔢 عدد الأحالات: ${referralCount}\n⭐ النجوم المتراكمة: ${userResult.rows[0].stars}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "مشاركة الرابط", url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=انضم%20إلى%20بوت%20شراء%20نجوم%20تليجرام!` }]
        ]
      }
    });
    return res.sendStatus(200);
  }

  // 7. معالجة الأمر /shop
  if (body.message?.text === "/shop") {
    const userId = body.message.from.id;
    const userResult = await pgClient.query('SELECT stars FROM referrals WHERE user_id = $1', [userId]);

    if (userResult.rows.length === 0) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "❗ يرجى إكمال عملية التسجيل أولاً عن طريق إرسال /start"
      });
      return res.sendStatus(200);
    }

    const userStars = userResult.rows[0].stars;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: userId,
      text: `🛒 متجر النجوم\n\n⭐ النجوم المتاحة: ${userStars}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "15 نجمة", callback_data: "buy_15" }],
          [{ text: "25 نجمة", callback_data: "buy_25" }],
          [{ text: "50 نجمة", callback_data: "buy_50" }],
          [{ text: "إدخال عدد مخصص", callback_data: "custom_amount" }]
        ]
      }
    });
    return res.sendStatus(200);
  }

  // 8. معالجة شراء النجوم
  if (body.callback_query?.data.startsWith('buy_')) {
    const action = body.callback_query.data;
    const userId = body.callback_query.from.id;
    const username = body.callback_query.from.username;

    if (action === "custom_amount") {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "📝 يرجى إدخال عدد النجوم التي ترغب في شرائها (الحد الأدنى 50 نجمة):",
        reply_markup: { force_reply: true }
      });
      return res.sendStatus(200);
    }

    const starsToBuy = parseInt(action.split('_')[1]);
    const userResult = await pgClient.query('SELECT stars FROM referrals WHERE user_id = $1', [userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].stars < starsToBuy) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "❌ لا تمتلك عدد كافي من النجوم. يمكنك كسب المزيد من خلال نظام الأحالات."
      });
      return res.sendStatus(200);
    }

    await pgClient.query('UPDATE referrals SET stars = stars - $1 WHERE user_id = $2', [starsToBuy, userId]);

    for (let adminId of ADMIN_IDS) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: adminId,
        text: `🛒 طلب شراء نجوم جديد\n👤 المستخدم: @${username}\n⭐ النجوم: ${starsToBuy}\n🆔 ID: ${userId}`,
      });
    }

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: userId,
      text: `✅ تم استلام طلبك لشراء ${starsToBuy} نجمة. سيتم إعلامك عند تنفيذ الطلب.`
    });

    return res.sendStatus(200);
  }

  // 9. معالجة الكمية المخصصة
  if (body.message?.reply_to_message?.text?.includes("إدخال عدد النجوم")) {
    const starsToBuy = parseInt(body.message.text);
    const userId = body.message.from.id;
    const username = body.message.from.username;

    if (isNaN(starsToBuy) || starsToBuy < 50) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "❌ الحد الأدنى لشراء النجوم هو 50 نجمة. يرجى إدخال عدد صحيح أكبر من أو يساوي 50."
      });
      return res.sendStatus(200);
    }

    const userResult = await pgClient.query('SELECT stars FROM referrals WHERE user_id = $1', [userId]);

    if (userResult.rows.length === 0 || userResult.rows[0].stars < starsToBuy) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "❌ لا تمتلك عدد كافي من النجوم. يمكنك كسب المزيد من خلال نظام الأحالات."
      });
      return res.sendStatus(200);
    }

    await pgClient.query('UPDATE referrals SET stars = stars - $1 WHERE user_id = $2', [starsToBuy, userId]);

    for (let adminId of ADMIN_IDS) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: adminId,
        text: `🛒 طلب شراء نجوم جديد\n👤 المستخدم: @${username}\n⭐ النجوم: ${starsToBuy}\n🆔 ID: ${userId}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ تأكيد التنفيذ", callback_data: `confirm_stars_${userId}_${starsToBuy}` }]
          ]
        }
      });
    }

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: userId,
      text: `✅ تم استلام طلبك لشراء ${starsToBuy} نجمة. سيتم إعلامك عند تنفيذ الطلب.`
    });

    return res.sendStatus(200);
  }

  // 10. معالجة رابط الدعوة
  if (body.message?.text?.startsWith("/start") && body.message.text.length > 7) {
    const referralCode = body.message.text.split(' ')[1];
    const userId = body.message.from.id;

    const userResult = await pgClient.query('SELECT * FROM referrals WHERE user_id = $1', [userId]);
    if (userResult.rows.length === 0 && referralCode) {
      await pgClient.query(
        'INSERT INTO referrals (user_id, username, invited_by) VALUES ($1, $2, $3)',
        [userId, body.message.from.username || 'غير معروف', referralCode]
      );

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: "🎉 تم تسجيلك بنجاح من خلال رابط الدعوة! يرجى إكمال عملية التحقق."
      });
    }
  }

  // 11. معالجة /start و /help و /database
  if (body.message && body.message.text === "/start") {
    const chatId = body.message.chat.id;
    const welcomeMessage = "مرحبًا بك في Panda Store 🐼\nافتح الموقع لشراء النجوم والاشتراك بريميوم وإدارة ملفك الشخصي.";
    const replyMarkup = {
      inline_keyboard: [
        [{ text: "تحقق من مواعيد العمل 🚀", callback_data: "check_order_time" }],
        [{ text: "انضمام الى قناه الاثباتات", url: "https://t.me/PandaStoreShop" }],
        [{ text: "�️ افتح الموقع", web_app: { url: `${WEB_BASE}` } }]
      ]
    };

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: welcomeMessage,
      reply_markup: replyMarkup
    });
  }

  // فتح صفحة الملف الشخصي داخل تليجرام
  if (body.message && (body.message.text === "/profile" || body.message.text === "profile")) {
    const chatId = body.message.chat.id;
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: "افتح الموقع من الزر بالأسفل:",
      reply_markup: {
        inline_keyboard: [
          [{ text: "�️ افتح الموقع", web_app: { url: `${WEB_BASE}` } }]
        ]
      }
    });
    return res.sendStatus(200);
  }

  if (body.message && body.message.text === "/help") {
    const chatId = body.message.chat.id;
    const helpMessage = "يمكنك التواصل مع مدير الموقع من هنا:";
    const replyMarkup = {
      inline_keyboard: [
        [{ text: "اتفضل يامحترم 🥰", url: "https://t.me/OMAR_M_SHEHATA" }]
      ]
    };

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: helpMessage,
      reply_markup: replyMarkup
    });
  }

  if (body.message && body.message.text === "/database") {
    const chatId = body.message.chat.id;
    const helpMessage = "عرض قائمة الطلبات:";
    const replyMarkup = {
      inline_keyboard: [
        [{ text: "DataBase🚀", web_app: { url: `${WEB_BASE}/admin.html` } }]
      ]
    };

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: helpMessage,
      reply_markup: replyMarkup
    });
  }

  // 12. معالجة الأزرار
  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (data === "check_order_time") {
      if (!isWorkingHours()) {
        const now = new Date();
        const timeOptions = {
          timeZone: 'Africa/Cairo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        };
        const currentTime = now.toLocaleTimeString('ar-EG', timeOptions);

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `❌ عذرًا، نحن خارج مواعيد العمل حاليًا.\n\n🕘 ساعات العمل: من 8 صباحًا حتى 12 منتصف الليل بتوقيت القاهرة (مصر).\n\n⏳ الوقت الحالي في مصر: ${currentTime}\n\n🔁 يرجى المحاولة مرة أخرى خلال ساعات العمل.\n\nروابط سريعة:`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⭐️ النجوم', url: `https://t.me/${BOT_USERNAME}/stars` },
                { text: '👑 البريميوم', url: `https://t.me/${BOT_USERNAME}/premium` }
              ],
              [
                { text: '🏠 واجهة الموقع', url: `https://t.me/${BOT_USERNAME}/start` }
              ]
            ]
          }
        });
      } else {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "✅ الموقع يعمل الآن! يمكنك البدء فورًا:\n\n- افتح الموقع من الزر أدناه\n- أو استخدم الروابط السريعة داخل البوت:",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🌐 افتح الموقع", web_app: { url: `${WEB_BASE}` } }],
              [
                { text: '⭐️ النجوم', url: `https://t.me/${BOT_USERNAME}/stars` },
                { text: '👑 البريميوم', url: `https://t.me/${BOT_USERNAME}/premium` }
              ],
              [
                { text: '🏠 واجهة البوت', url: `https://t.me/${BOT_USERNAME}/start` }
              ]
            ]
          }
        });
      }
    }

    try {
      if (data === "contact_admin") {
        const adminMessage = "يمكنك التواصل مع مدير الموقع من هنا:";
        const replyMarkup = {
          inline_keyboard: [
            [{ text: "اتفضل يامحترم 🥰", url: "https://t.me/OMAR_M_SHEHATA" }]
          ]
        };

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: adminMessage,
          reply_markup: replyMarkup
        });
      }

      if (data.startsWith('complete_')) {
        const orderId = data.split('_')[1];

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "هل أنت متأكد أن هذا الطلب تم تنفيذه❓",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "نعم ✅", callback_data: `confirmComplete_${orderId}_${messageId}` },
                { text: "لا ❌", callback_data: "cancel" }
              ]
            ]
          }
        });
      }

      if (data.startsWith('confirmComplete_')) {
        const [_, orderId, messageIdToUpdate] = data.split('_');

        await pgClient.query('UPDATE orders SET completed = true WHERE id = $1', [orderId]);

        try {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
            chat_id: chatId,
            message_id: messageId
          });
        } catch (deleteErr) {
          if (deleteErr.response?.data?.description !== 'Bad Request: message to delete not found') {
            console.error("Error deleting confirmation message:", deleteErr);
          }
        }

        try {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
            chat_id: chatId,
            message_id: messageIdToUpdate,
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ تم تنفيذ هذا الطلب بالفعل", callback_data: "already_completed" }]
              ]
            }
          });
        } catch (editErr) {
          console.error("Error editing message:", editErr);
        }

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "🎉تم تحديث حالة الطلب بنجاح🎉"
        });
      }

      if (data.startsWith('confirm_stars_')) {
        const [_, userId, stars] = data.split('_');

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: userId,
          text: `🎉 تم تنفيذ طلبك لشراء ${stars} نجمة بنجاح! شكرًا لاستخدامك Panda Store.`
        });

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
          chat_id: chatId,
          message_id: messageId
        });
      }

      if (data === "cancel") {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "❌ تم إلغاء العملية",
          reply_markup: { remove_keyboard: true }
        });
      }

    } catch (error) {
      console.error("❌ خطأ أثناء معالجة زر البوت:", error.response ? error.response.data : error.message);
    }
  }

  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("✅ Panda Store backend is running!");
});

const activateWebhook = async () => {
  try {
    const PUBLIC_URL = process.env.PUBLIC_URL || WEB_BASE;
    const botUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${encodeURI(PUBLIC_URL)}/telegramWebhook`;
    const { data } = await axios.get(botUrl);
    console.log("✅ Webhook set successfully:", data);
  } catch (error) {
    console.error("❌ Failed to set webhook:", error.response ? error.response.data : error.message);
  }
};

const PORT = process.env.PORT || 3000;
// ==========================
// Proxy: Buy Stars via MarketApp API with optional margin message
// ==========================
// عنوان ربح ثابت لتقليل الاعتماد على المتغيرات (يمكن تغييره هنا مباشرة)
const FIXED_PROFIT_ADDRESS = 'UQAcDae1BvWVAD0TkhnGgDme4b7NH9Fz8JXce-78TW6ekmvN';
app.post('/buy', async (req, res) => {
  try {
    const { username, quantity } = req.body || {};
    if (!username || !quantity) {
      return res.status(422).json({ detail: [{ loc: ['body', 'username/quantity'], msg: 'username and quantity required', type: 'value_error' }] });
    }

    const upstreamUrl = process.env.MARKETAPP_URL || 'https://api.marketapp.ws/v1/fragment/stars/buy/';
    const apiAuth = process.env.MARKETAPP_AUTH;
    if (!apiAuth) return res.status(500).json({ error: 'config_error', message: 'MARKETAPP_AUTH missing' });

    // 1. Call upstream to get its base transaction (this includes core payment to API address)
    const upResp = await axios.post(upstreamUrl, { username, quantity }, {
      headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': apiAuth },
      timeout: 15000
    });
    const transaction = upResp.data.transaction || { messages: [] };
    if (!Array.isArray(transaction.messages)) transaction.messages = [];

    // 2. Fixed tier pricing margin calculation (no env config):
    // إذا العدد أقل من 1500 => سعر البيع لكل نجمة 0.016
    // إذا العدد أكبر أو يساوي 1500 => سعر البيع لكل نجمة 0.0156
    // نفترض أن أول رسالة في transaction.messages تمثل التكلفة الفعلية (المبلغ الذي سيذهب للـ API)
    // نحسب كم المفروض يدفع المستخدم حسب سعر البيع، ثم الفرق هو هامشك.
  const profitAddress = process.env.PROFIT_ADDRESS || process.env.AUTO_MARGIN_ADDRESS || process.env.MARGIN_ADDRESS || FIXED_PROFIT_ADDRESS;
    if (transaction.messages.length > 0 && profitAddress) {
      const sellPricePerStar = Number(quantity) >= 1500 ? 0.0156 : 0.016; // USD
      const targetTotalUsd = sellPricePerStar * Number(quantity); // ما تريده من العميل

      // استنتاج التكلفة (upstream cost) من خلال تحويل أول مبلغ TON إلى USD:
      // نحتاج سعر TON بالدولار لجلب الفرق. سنأخذ Coingecko وإلا FALLBACK_TON_USD أو 5.
      let tonUsd = null;
      try {
        const priceResp = await axios.get('https://api.coingecko.com/api/v3/simple/price', { params: { ids: 'the-open-network', vs_currencies: 'usd' }, timeout: 5000 });
        tonUsd = priceResp.data?.['the-open-network']?.usd;
      } catch (e) {
        tonUsd = parseFloat(process.env.FALLBACK_TON_USD || '5');
      }
      if (!tonUsd || tonUsd <= 0) tonUsd = 5;

      const firstMsg = transaction.messages[0];
      const baseNano = BigInt(firstMsg.amount || '0');
      const baseTon = Number(baseNano) / 1e9; // قد يكفي للأرقام المعقولة
      const baseUsd = baseTon * tonUsd;
      const marginUsd = targetTotalUsd - baseUsd;

      if (marginUsd > 0.0000001) {
        const marginTon = marginUsd / tonUsd;
        const marginNano = BigInt(Math.ceil(marginTon * 1e9));
        if (marginNano > 0n) {
          transaction.messages.push({
            address: profitAddress,
            amount: marginNano.toString(),
            payload: process.env.AUTO_MARGIN_PAYLOAD || '',
            stateInit: null
          });
        }
      }
    }

    return res.json({ transaction });
  } catch (err) {
    console.error('Error /buy proxy dynamic margin:', err.response?.data || err.message);
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  await activateWebhook();
});
