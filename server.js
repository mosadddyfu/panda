require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();

// المتغيرات
const mongoURI = process.env.MONGO_URI;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = [process.env.ADMIN_ID, process.env.SECOND_ADMIN_ID];

// ✅ الاتصال بقاعدة البيانات
mongoose.connect(mongoURI)
  .then(() => console.log("✅ تم الاتصال بقاعدة بيانات MongoDB Atlas بنجاح"))
  .catch((error) => console.error("❌ فشل الاتصال بقاعدة البيانات:", error));

// ✅ موديل الطلبات
const orderSchema = new mongoose.Schema({
  username: String,
  stars: Number,
  amountTon: String,
  amountUsd: String,
  createdAt: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false },
});
const Order = mongoose.model('Order', orderSchema);

// ✅ ميدلويرز
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static('public'));

// ✅ راوت طلب أوردر جديد
app.post('/order', async (req, res) => {
  try {
    const { username, stars, amountTon, amountUsd, createdAt } = req.body;
    const orderCreatedAt = createdAt || new Date().toISOString();

    const formattedDate = new Date(orderCreatedAt).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: 'Africa/Cairo',
    });

    const newOrder = new Order({ username, stars, amountTon, amountUsd, createdAt: orderCreatedAt });
    await newOrder.save();

    const fragmentLink = "https://fragment.com/stars";

    for (let adminId of ADMIN_IDS) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: adminId,
        text: `New Order 🛒\n👤 Username: @${username}\n⭐️ Stars: ${stars}\n💰 TON: ${amountTon} TON\n💵 USDT: ${amountUsd} USDT\n📅 Order Date: ${formattedDate}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔗 تنفيذ الطلب للمستخدم", web_app: { url: fragmentLink } }
            ],
            [
              { text: "✅ تم التنفيذ في قاعدة البيانات", callback_data: `complete_${newOrder._id}` }
            ]
          ]
        }
      });
    }

    res.status(200).send('✅ تم استلام طلبك بنجاح!');
  } catch (error) {
    console.error(error);
    res.status(500).send('❌ حدث خطأ أثناء معالجة الطلب');
  }
});

// ✅ راوت عرض جميع الطلبات
app.get('/admin', async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).send('❌ حدث خطأ أثناء جلب البيانات');
  }
});

// ✅ راوت إنهاء الطلب يدويًا
app.post('/complete-order/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    await Order.findByIdAndUpdate(orderId, { completed: true });
    res.status(200).send('✅ تم تحديث حالة الطلب');
  } catch (error) {
    console.error(error);
    res.status(500).send('❌ حدث خطأ أثناء تحديث الطلب');
  }
});

// ✅ راوت الويب هوك الخاص بالبوت
app.post('/telegramWebhook', async (req, res) => {
  const body = req.body;

  if (body.message && body.message.text === "/start") {
    const chatId = body.message.chat.id;
    const welcomeMessage = "مرحبًا بك في Panda Store 🐼\nيمكنك شراء نجوم تليجرام من موقعنا الرسمى🚀";
    const replyMarkup = {
      inline_keyboard: [
        [{ text: "افتح Panda Store🚀", url: "https://pandastores.onrender.com" }],
        [{ text: "تواصل مع مدير الموقع", callback_data: "contact_admin" }]  // زر دائم للتواصل مع المدير
      ]
    };

    // إرسال رسالة ترحيب مع الزر الدائم
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: welcomeMessage,
      reply_markup: replyMarkup
    });
  }

  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
      if (data === "contact_admin") {
        // إرسال رسالة تحتوي على رابط للتواصل مع المدير
        const adminMessage = "يمكنك التواصل مع مدير الموقع من هنا:";
        const replyMarkup = {
          inline_keyboard: [
            [{ text: "@OMAR_M_SHEHATA", url: "https://t.me/OMAR_M_SHEHATA" }]  // رابط للـ Telegram username
          ]
        };

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: adminMessage,
          reply_markup: replyMarkup
        });
      }

      // التعامل مع باقي الزرار
      if (data.startsWith('complete_')) {
        const orderId = data.split('_')[1];

        // إرسال سؤال تأكيدي
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
        const [_, orderId, messageId] = data.split('_');

        // تحديث حالة الطلب في قاعدة البيانات
        await Order.findByIdAndUpdate(orderId, { completed: true });
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "✅ تم تحديث حالة الطلب بنجاح",
          reply_markup: { remove_keyboard: true }
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

// ✅ الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("✅ Panda Store backend is running!");
});

// ✅ إعداد الويب هوك تلقائيًا عند تشغيل السيرفر
const activateWebhook = async () => {
  try {
    const botUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=https://pandastores.onrender.com/telegramWebhook`;
    const { data } = await axios.get(botUrl);
    console.log("✅ Webhook set successfully:", data);
  } catch (error) {
    console.error("❌ Failed to set webhook:", error.response ? error.response.data : error.message);
  }
};

// ✅ تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  await activateWebhook();
});
