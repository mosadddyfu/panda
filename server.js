require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();

const mongoURI = process.env.MONGO_URI;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = [process.env.ADMIN_ID, process.env.SECOND_ADMIN_ID];

// ✅ الاتصال بقاعدة البيانات
mongoose.connect(mongoURI)
  .then(() => console.log("تم الاتصال بقاعدة بيانات MongoDB Atlas بنجاح"))
  .catch((error) => console.error("فشل الاتصال بقاعدة البيانات:", error));

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
              { text: "🔗 تنفيذ الطلب", web_app: { url: fragmentLink } }
            ],
            [
              { text: "✅ تم التنفيذ في قاعدة البيانات", callback_data: `complete_${newOrder._id}` }
            ]
          ]
        }
      });
    }

    res.status(200).send('Your order has been successfully received!');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while processing the order');
  }
});

// ✅ راوت عرض الطلبات للإدارة
app.get('/admin', async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while fetching data');
  }
});

// ✅ راوت إنهاء الطلب
app.post('/complete-order/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    await Order.findByIdAndUpdate(orderId, { completed: true });
    res.status(200).send('Order status updated to completed');
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while updating the order');
  }
});

// ✅ التعامل مع ضغط زر من البوت (Webhook)
app.post('/telegramWebhook', async (req, res) => {
  const body = req.body;

  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (data.startsWith('complete_')) {
      const orderId = data.split('_')[1];

      // ❓ نرسل سؤال تأكيدي
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "❓ هل أنت متأكد أنك تريد تنفيذ هذا الطلب؟",
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
      const [_, orderId, originalMessageId] = data.split('_');

      try {
        await Order.findByIdAndUpdate(orderId, { completed: true });

        // ✏️ تعديل الرسالة الأصلية والزر
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
          chat_id: chatId,
          message_id: originalMessageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ تم التنفيذ", callback_data: "done" }
              ]
            ]
          }
        });

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "🎉 تم تحديث حالة الطلب بنجاح."
        });
      } catch (error) {
        console.error(error);
      }
    }

    if (data === "cancel") {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "❌ تم إلغاء تنفيذ الطلب."
      });
    }
  }

  res.sendStatus(200);
});

// ✅ صفحة البداية
app.get("/", (req, res) => {
  res.send("✅ Panda Store backend is running!");
});

// ✅ تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
