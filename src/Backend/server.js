const express = require('express');
const axios = require('axios');
require('dotenv').config();

const audioProxyRouter = require('./audioProxy'); // Import router từ audioProxy.js
const app = express();
const PORT = process.env.PORT || 5053;

// Middleware để parse JSON nếu sau này bạn muốn gửi data lên
app.use(express.json());

// Route trang chủ: Kiểm tra xem Bot Service có đang chạy không
app.get('/', (req, res) => {
    res.send({
        status: 'online',
        message: '🤖 Discord Bot Backend Service is running!',
        timestamp: new Date().toISOString()
    });
});

// Route Health Check (thường dùng cho UptimeRobot hoặc Cloud Health Check)
app.get('/health', (req, res) => {
    res.status(200).json({ uptime: process.uptime() });
});

// Gắn audioProxyRouter vào ứng dụng chính
app.use(audioProxyRouter);

function startServer() {
    app.listen(PORT, () => {
        console.log(`══════════════════════════════════`);
        console.log(`🌐 Backend Service running on http://localhost:${PORT}`);
        console.log(`══════════════════════════════════`);
    });
}

module.exports = startServer;