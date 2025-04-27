require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();

const mongoURI = process.env.MONGO_URI;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = [process.env.ADMIN_ID, process.env.SECOND_ADMIN_ID]; // معرفات متعددة

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
  completed: { type: Boolean, default: false }, // ➡️ الحقل الجديد
});

const Order = mongoose.model('Order', orderSchema);

// ✅ ميدلويرز
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static('public'));

// ✅ راوت الطلب
app.post('/order', async (req, res) => {
  try {
    const { username, stars, amountTon, amountUsd, createdAt } = req.body;

    // إذا لم يكن createdAt موجودًا، نضيف التاريخ الحالي
    const orderCreatedAt = createdAt || new Date().toISOString();

    // تنسيق التاريخ ليظهر بالشكل المطلوب باللغة الإنجليزية (يوم/شهر/سنة الساعة:الدقيقة:الثانية)
const formattedDate = new Date(orderCreatedAt).toLocaleString('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true, // لضبط تنسيق الـ AM/PM
  timeZone: 'Africa/Cairo', // تحديد المنطقة الزمنية لمصر
});

    const newOrder = new Order({ username, stars, amountTon, amountUsd, createdAt: orderCreatedAt });

    await newOrder.save();

    const message = `New Order 🛒\n👤 Username: @${username}\n⭐️ Stars: ${stars}\n💰 TON: ${amountTon} TON\n💵 USDT: ${amountUsd} USDT\n📅 Order Date: ${formattedDate}\n\n🔗Execute Order: https://fragment.com/stars`;

    // إرسال الرسالة إلى جميع المعرفات
    for (let adminId of ADMIN_IDS) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: adminId,
        text: message,
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

// ✅ راوت تحديث حالة الطلب إلى مكتمل
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

// ✅ صفحة البداية
app.get("/", (req, res) => {
  res.send("✅ Panda Store backend is running!");
});

// ✅ تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
