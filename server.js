require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const redis = require('redis');
const { Queue } = require('bullmq');
const cluster = require('cluster');
const os = require('os');

// المتغيرات
const mongoURI = process.env.MONGO_URI;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = [process.env.ADMIN_ID, process.env.SECOND_ADMIN_ID];
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize Redis
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.connect().catch(console.error);

// Initialize BullMQ Queue
const orderQueue = new Queue('orderProcessing', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  }
});

// ✅ اتصال MongoDB مع Connection Pooling
mongoose.connect(mongoURI, {
  maxPoolSize: 50,
  socketTimeoutMS: 30000,
  waitQueueTimeoutMS: 30000
})
.then(() => console.log("✅ تم الاتصال بقاعدة بيانات MongoDB Atlas بنجاح"))
.catch((error) => console.error("❌ فشل الاتصال بقاعدة البيانات:", error));

// ✅ موديل الطلبات مع Indexes
const orderSchema = new mongoose.Schema({
  username: { type: String, index: true },
  stars: Number,
  amountTon: String,
  amountUsd: String,
  createdAt: { type: Date, default: Date.now, index: true },
  completed: { type: Boolean, default: false, index: true },
});
const Order = mongoose.model('Order', orderSchema);

// Cluster Mode
if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  const app = express();

  // Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static('public'));

  // ✅ Async Handler
  const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  // ✅ راوت طلب أوردر جديد مع Queue
  app.post('/order', asyncHandler(async (req, res) => {
    const { username, stars, amountTon, amountUsd, createdAt } = req.body;
    
    // Add to queue
    await orderQueue.add('processOrder', {
      username, stars, amountTon, amountUsd, createdAt
    });

    res.status(202).json({ 
      status: 'Processing',
      message: '✅ تم استلام طلبك بنجاح وسيتم معالجته قريباً'
    });
  }));

  // ✅ Process Order Queue
  orderQueue.process('processOrder', async (job) => {
    const { username, stars, amountTon, amountUsd, createdAt } = job.data;
    
    const orderCreatedAt = createdAt || new Date().toISOString();
    const formattedDate = new Date(orderCreatedAt).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: 'Africa/Cairo',
    });

    const newOrder = new Order({ username, stars, amountTon, amountUsd, createdAt: orderCreatedAt });
    await newOrder.save();

    const fragmentLink = "https://fragment.com/stars";
    const message = `New Order 🛒\n👤 Username: @${username}\n⭐️ Stars: ${stars}\n💰 TON: ${amountTon} TON\n💵 USDT: ${amountUsd} USDT\n📅 Order Date: ${formattedDate}`;

    // Send to all admins in parallel
    await Promise.all(ADMIN_IDS.map(async (adminId) => {
      try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: adminId,
          text: message,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔗 تنفيذ الطلب للمستخدم", web_app: { url: fragmentLink } }],
              [{ text: "✅ تم التنفيذ في قاعدة البيانات", callback_data: `complete_${newOrder._id}` }]
            ]
          }
        });
      } catch (error) {
        console.error(`Failed to send to admin ${adminId}:`, error.message);
      }
    }));
  });

  // ✅ راوت عرض جميع الطلبات مع Redis Caching
  app.get('/admin', asyncHandler(async (req, res) => {
    const cacheKey = 'all_orders';
    const cachedOrders = await redisClient.get(cacheKey);
    
    if (cachedOrders) {
      return res.json(JSON.parse(cachedOrders));
    }

    const orders = await Order.find().lean();
    await redisClient.set(cacheKey, JSON.stringify(orders), { EX: 60 }); // Cache for 1 minute
    res.json(orders);
  }));

  // ✅ راوت إنهاء الطلب يدويًا
  app.post('/complete-order/:id', asyncHandler(async (req, res) => {
    const orderId = req.params.id;
    await Order.findByIdAndUpdate(orderId, { completed: true });
    
    // Invalidate cache
    await redisClient.del('all_orders');
    
    res.status(200).send('✅ تم تحديث حالة الطلب');
  }));

  // ✅ راوت الويب هوك الخاص بالبوت
  app.post('/telegramWebhook', asyncHandler(async (req, res) => {
    const body = req.body;

    if (body.message?.text === "/start") {
      const chatId = body.message.chat.id;
      const welcomeMessage = "مرحبًا بك في Panda Store 🐼\nيمكنك شراء نجوم تليجرام من موقعنا الرسمى🚀";
      
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: welcomeMessage,
        reply_markup: {
          inline_keyboard: [
            [{ text: "افتح Panda Store🚀", url: "https://pandastores.onrender.com" }],
            [{ text: "تواصل مع مدير الموقع", callback_data: "contact_admin" }]
          ]
        }
      });
    }

    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      try {
        if (data === "contact_admin") {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: "يمكنك التواصل مع مدير الموقع من هنا:",
            reply_markup: {
              inline_keyboard: [
                [{ text: "@OMAR_M_SHEHATA", url: "https://t.me/OMAR_M_SHEHATA" }]
              ]
            }
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
                  { text: "نعم ✅", callback_data: `confirmComplete_${orderId}` },
                  { text: "لا ❌", callback_data: "cancel" }
                ]
              ]
            }
          });
        }
      } catch (error) {
        console.error("❌ خطأ أثناء معالجة زر البوت:", error.message);
      }
    }

    res.sendStatus(200);
  }));

  // ✅ الصفحة الرئيسية
  app.get("/", (req, res) => {
    res.send("✅ Panda Store backend is running!");
  });

  // ✅ Error Handling Middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('❌ حدث خطأ في السيرفر');
  });

  // ✅ تشغيل السيرفر
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Worker ${process.pid} running on port ${PORT}`);
  });

  // ✅ إعداد الويب هوك تلقائيًا
  const activateWebhook = async () => {
    try {
      const { data } = await axios.get(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=https://pandastores.onrender.com/telegramWebhook`
      );
      console.log("✅ Webhook set successfully:", data);
    } catch (error) {
      console.error("❌ Failed to set webhook:", error.message);
    }
  };

  activateWebhook();
}
