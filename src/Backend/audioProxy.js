const express = require("express");
const axios = require("axios");
require("dotenv").config();
const scdl = require("soundcloud-downloader").default;
const { YoutubeSearchApi } = require("youtube-search-api");

const router = express.Router();

// Kiểm tra YouTube link
function isYouTubeLink(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(url);
}

// Lấy title từ YouTube link
async function getYouTubeTitle(url) {
  try {
    const videoId = url.split("v=")[1] || url.split("youtu.be/")[1];
    const result = await YoutubeSearchApi.GetVideoById(videoId);
    return result?.title || null;
  } catch {
    return null;
  }
}

// Tìm kiếm SoundCloud theo từ khóa và trả về stream
async function getSoundCloudStreamFromKeyword(keyword) {
  const tracks = await scdl.search({ query: keyword, resourceType: "tracks" });
  if (!tracks?.collection?.length) return null;
  const track = tracks.collection[0];
  // Sử dụng scdl.download để lấy stream trực tiếp, ổn định hơn
  const stream = await scdl.download(track.permalink_url);
  return stream;
}

router.get("/proxy-audio", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).send("Thiếu tham số url");

  url = decodeURIComponent(url);
  console.log(`🔗 Input: ${url}`);

  // Xử lý Range-Request từ discord.js/voice để tránh vòng lặp
  // Nếu client yêu cầu một phần của file, ta sẽ báo là không hỗ trợ
  // và chỉ stream từ đầu. Điều này ngăn client request lại liên tục.
  if (req.headers.range && req.headers.range !== 'bytes=0-') {
    return res.status(416).send('Range Not Satisfiable. This proxy only supports streaming from the beginning.');
  }

  try {
    let audioStream;

    if (isYouTubeLink(url)) {
      const title = await getYouTubeTitle(url);
      if (!title) return res.status(404).send("Không lấy được title YouTube");
      console.log(`🔍 Searching SoundCloud for: ${title}`);
      audioStream = await getSoundCloudStreamFromKeyword(title);
      if (!audioStream) return res.status(404).send("Không tìm thấy bài hát tương ứng trên SoundCloud");
    } else if (scdl.isValidUrl(url)) {
      // Là link SoundCloud -> tải trực tiếp
      console.log(`🔊 Downloading from SoundCloud URL: ${url}`);
      audioStream = await scdl.download(url);
    } else if (url.startsWith("http")) {
      // Là một link khác (có thể là link stream trực tiếp)
      console.log(`🎵 Streaming directly from URL: ${url.substring(0, 80)}...`);
      const response = await axios({
        method: "GET",
        url: url,
        responseType: "stream",
        headers: { 'Range': req.headers.range || 'bytes=0-' },
      });
      audioStream = response.data;
    } else {
      // Là từ khóa tìm kiếm
      console.log(`🔍 Searching SoundCloud for: ${url}`);
      audioStream = await getSoundCloudStreamFromKeyword(url);
      if (!audioStream) return res.status(404).send("Không tìm thấy bài hát trên SoundCloud");
    }

    console.log(`🎵 Streaming audio to client...`);

    // Thiết lập header để client biết đây là stream audio
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "none"); // Thông báo cho client rằng chúng ta không hỗ trợ range requests

    // Xử lý lỗi và đóng kết nối
    req.on('close', () => {
      console.log('Client disconnected, stopping stream pipe.');
      audioStream.destroy();
    });
    audioStream.on('error', (streamErr) => {
      console.error('Audio stream error:', streamErr.message);
      if (!res.headersSent) res.status(500).send('Lỗi stream audio.');
    });

    audioStream.pipe(res);

  } catch (err) {
    console.error("Proxy Error:", err.message);
    if (!res.headersSent) res.status(500).send("Không thể stream audio.");
  }
});

module.exports = router;
// Nếu là YouTube link hoặc text query → tìm trên SoundCloud