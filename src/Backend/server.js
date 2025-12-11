const express = require('express');
const axios = require('axios');
require('dotenv').config();

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

// Route Proxy Audio: Stream audio từ URL gốc về Client (Discord Bot)
app.get("/proxy-audio", async (req, res) => {
    const { url } = req.query;

    if (!url) return res.status(400).send('Thiếu tham số "url"');
    console.log(`🔗 Proxying: ${url.substring(0, 50)}...`);

    try {
        // Logic Proxy chuẩn: Dùng axios để pipe luồng dữ liệu từ URL gốc về Client
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            decompress: false, // QUAN TRỌNG: Ngăn axios tự giải nén, giữ nguyên luồng dữ liệu gốc
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // 'Referer': 'https://www.youtube.com/', // Bỏ Referer để tránh xung đột với một số loại link Google
                'Accept': '*/*',
                'Connection': 'keep-alive',
                // Google Video thường yêu cầu Range header, nếu client không gửi thì mặc định lấy từ đầu
                Range: req.headers.range || 'bytes=0-'
            },
            validateStatus: () => true
        });

        // Forward status code và headers quan trọng
        res.status(response.status);
        const headersToForward = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
        headersToForward.forEach(header => {
            if (response.headers[header]) {
                res.setHeader(header, response.headers[header]);
            }
        });

        if (response.status >= 400) {
            console.warn(`⚠️ Upstream returned status: ${response.status} - Link có thể đã hết hạn hoặc sai IP.`);
        }

        // Nối ống (pipe) dữ liệu
        response.data.pipe(res);

    } catch (err) {
        console.error("Lỗi Proxy:", err.message);
        res.status(500).send("Không thể stream audio.");
    }
});

// Route Health Check (thường dùng cho UptimeRobot hoặc Cloud Health Check)
app.get('/health', (req, res) => {
    res.status(200).json({ uptime: process.uptime() });
});

function startServer() {
    app.listen(PORT, () => {
        console.log(`══════════════════════════════════`);
        console.log(`🌐 Backend Service running on http://localhost:${PORT}`);
        console.log(`══════════════════════════════════`);
    });
}

module.exports = startServer;