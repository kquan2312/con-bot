const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5053;

app.get("/proxy-audio", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing "url"');

    try {
        const response = await axios({
            method: "GET",
            url,
            responseType: "stream",
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Range": "bytes=0-" // REQUIRED
            }
        });

        res.setHeader("Content-Type", "audio/webm");

        response.data.pipe(res);

    } catch (err) {
        console.error("Proxy Error:", err.message);
        res.status(500).send("Cannot stream audio.");
    }
});

app.listen(PORT, () => {
    console.log(`🎧 Audio Proxy running on port ${PORT}`);
});
