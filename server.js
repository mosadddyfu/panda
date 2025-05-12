require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();
function isWorkingHours() {
  const now = new Date().toLocaleString("en-GB", { timeZone: "Africa/Cairo" });
  const hour = new Date(now).getHours();
  return hour >= 20 && hour < 24; // من 9 صباحًا لـ 12 بليل
}


const mongoURI = process.env.MONGO_URI;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = [process.env.ADMIN_ID, process.env.SECOND_ADMIN_ID];

mongoose.connect(mongoURI)
  .then(() => console.log("✅ تم الاتصال بقاعدة بيانات MongoDB Atlas بنجاح"))
  .catch((error) => console.error("❌ فشل الاتصال بقاعدة البيانات:", error));

const orderSchema = new mongoose.Schema({
  username: String,
  stars: Number,
  amountTon: String,
  amountUsd: String,
  createdAt: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false },
});
const Order = mongoose.model('Order', orderSchema);

app.use(express.json());
app.use(bodyParser.json());
app.use(express.static('public'));

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
              { text: "🛩 تحديث الطلب فى قاعده البيانات", callback_data: `complete_${newOrder._id}` }
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

app.get('/admin', async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).send('❌ حدث خطأ أثناء جلب البيانات');
  }
});

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

app.post('/telegramWebhook', async (req, res) => {

  const body = req.body;

  if (body.message && body.message.text === "/start") {
    const chatId = body.message.chat.id;
    const welcomeMessage = "مرحبًا بك في Panda Store 🐼\nيمكنك شراء نجوم تليجرام من موقعنا الرسمى🚀";
    const replyMarkup = {
      inline_keyboard: [
        [{ text: "للمشاهدة اضغط هنا 🚀", callback_data: "watch_warning" }],
        [{ text: "للشراء والطلب اضغط هنا 🚀", callback_data: "check_order_time" }],
        [{ text: "انضمام الى قناه الاثباتات", url: "https://t.me/Buy_StarsTG" }]

      ]
    };

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: welcomeMessage,
      reply_markup: replyMarkup
    });
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
        [{ text: "DataBase🚀", web_app:{ url: "https://pandastores.onrender.com/admin.html"} }]
      ]
    };

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: helpMessage,
      reply_markup: replyMarkup
    });
  }
  

  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;


    if (data === "check_order_time") {
  if (!isWorkingHours()) {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: "❌ عذرًا، نحن خارج مواعيد العمل حاليًا.\n🕘 ساعات العمل: من 9 صباحًا حتى 12 بليل بتوقيت القاهرة.\n🔁 حاول مرة تانية خلال ساعات العمل."
    });
  } else {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: "✅ يمكنك الآن تقديم طلبك من خلال الموقع:",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 ابدأ الطلب الآن", web_app: { url: "https://pandastores.onrender.com" } }]
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

      if (data === "watch_warning") {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "⚠️ إذا قمت بالشراء من هنا لن يصلني طلبك ⚠️",
          reply_markup: {
            inline_keyboard: [
                           [{ text: "🚀 الاستمرار للمشاهدة", web_app: { url: "https://pandastores.netlify.app" } }]
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
                { text: "نعم ✅", callback_data: `confirmComplete_${orderId}_${messageId}` },
                { text: "لا ❌", callback_data: "cancel" }
              ]
            ]
          }
        });
      }

      if (data.startsWith('confirmComplete_')) {
        const [_, orderId, messageIdToUpdate] = data.split('_');

        await Order.findByIdAndUpdate(orderId, { completed: true });

        // ✅ حذف رسالة التأكيد
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
          chat_id: chatId,
          message_id: messageId
        });

        // ✅ تحديث الرسالة الأصلية
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
          chat_id: chatId,
          message_id: messageIdToUpdate,
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ تم تنفيذ هذا الطلب بالفعل", callback_data: "already_completed" }]
            ]
          }
        });

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "🎉تم تحديث حالة الطلب بنجاح🎉"
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
    const botUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=https://pandastores.onrender.com/telegramWebhook`;
    const { data } = await axios.get(botUrl);
    console.log("✅ Webhook set successfully:", data);
  } catch (error) {
    console.error("❌ Failed to set webhook:", error.response ? error.response.data : error.message);
  }
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  await activateWebhook();
});
