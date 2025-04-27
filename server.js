require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();

const mongoURI = process.env.MONGO_URI;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

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
    const { username, stars, amountTon, amountUsd } = req.body;
    const newOrder = new Order({ username, stars, amountTon, amountUsd });

    await newOrder.save();

    const message = `طلب جديد:\nاسم المستخدم: ${username}\nعدد النجوم: ${stars}`;
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: ADMIN_ID,
      text: message,
    });

    res.status(200).send('طلبك تم استلامه بنجاح!');
  } catch (error) {
    console.error(error);
    res.status(500).send('حدث خطأ أثناء معالجة الطلب');
  }
});

// ✅ راوت عرض الطلبات للإدارة
app.get('/admin', async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).send('حدث خطأ في جلب البيانات');
  }
});

// ✅ راوت تحديث حالة الطلب إلى مكتمل
app.post('/complete-order/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    await Order.findByIdAndUpdate(orderId, { completed: true });
    res.status(200).send('تم تحديث حالة الطلب إلى مكتمل');
  } catch (error) {
    console.error(error);
    res.status(500).send('حدث خطأ أثناء تحديث الطلب');
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
