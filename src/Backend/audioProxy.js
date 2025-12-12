const express = require("express");
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
    const videoId = url.includes("v=")
      ? url.split("v=")[1].split("&")[0]
      : url.split("youtu.be/")[1].split("?")[0];
    const result = await YoutubeSearchApi.GetVideoById(videoId);
    return result?.title || null;
  } catch {
    return null;
  }
}

// Lấy stream trực tiếp từ SoundCloud URL
async function getSoundCloudStream(url) {
  // Dùng scdl.download để tự động chọn format (ưu tiên progressive) và tránh lỗi object mismatch
  return await scdl.download(url);
}

// Tìm kiếm SoundCloud theo keyword và lấy stream
// async function getSoundCloudStreamFromKeyword(keyword) {
//   const tracks = await scdl.search({ query: keyword, resourceType: "tracks" });
//   if (!tracks?.collection?.length) return null;
//   const track = tracks.collection[0];
//   return await getSoundCloudStream(track.permalink_url);
// }
async function getSoundCloudStreamFromKeyword(keyword) {
  const tracks = await scdl.search({ query: keyword, resourceType: "tracks" });
  if (!tracks?.collection?.length) return null;

  // Loop qua từng track cho tới khi tìm được track stream được
  for (const track of tracks.collection) {
    try {
      const stream = await getSoundCloudStream(track.permalink_url);
      console.log(`🔊 Streaming track: ${track.title} | ${track.permalink_url}`);
      return stream; // trả về stream đầu tiên thành công
    } catch (err) {
      console.warn(
        `⚠️ Không thể stream track: ${track.title} | ${track.permalink_url} → ${err.message}`
      );
      // thử track tiếp theo
    }
  }

  // Nếu hết tracks vẫn không stream được
  return null;
}

router.get("/proxy-audio", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).send("Thiếu tham số url");

  url = decodeURIComponent(url);
  console.log(`🔗 Input: ${url}`);

  try {
    let audioStream;

    if (isYouTubeLink(url)) {
      const title = await getYouTubeTitle(url);
      if (!title) return res.status(404).send("Không lấy được title YouTube");
      console.log(`🔍 Searching SoundCloud for: ${title}`);
      audioStream = await getSoundCloudStreamFromKeyword(title);
      if (!audioStream) return res.status(404).send("Không tìm thấy bài hát trên SoundCloud");
    } else if (scdl.isValidUrl(url)) {
      console.log(`🔊 Streaming directly from SoundCloud URL: ${url}`);
      try {
        audioStream = await getSoundCloudStream(url); // stream nguyên bài
      } catch (err) {
        console.warn(`⚠️ Direct stream failed: ${err.message}. Attempting fallback search...`);
        const slug = url.split("?")[0].split("/").filter(Boolean).pop();
        if (slug) {
          const keyword = slug.replace(/-/g, " ");
          console.log(`🔍 Fallback searching for: ${keyword}`);
          audioStream = await getSoundCloudStreamFromKeyword(keyword);
        }
        if (!audioStream) return res.status(404).send("Không tìm thấy bài hát trên SoundCloud (Fallback failed)");
      }
    } else {
      console.log(`🔍 Searching SoundCloud for: ${url}`);
      audioStream = await getSoundCloudStreamFromKeyword(url);
      if (!audioStream) return res.status(404).send("Không tìm thấy bài hát trên SoundCloud");
    }

    console.log(`🎵 Streaming audio to client...`);

    res.setHeader("Content-Type", "audio/mpeg");

    req.on("close", () => {
      if (audioStream) audioStream.destroy();
    });

    audioStream.on("error", (err) => {
      console.error("Audio stream error:", err.message);
      if (!res.headersSent) res.status(500).send("Lỗi khi stream audio");
    });

    audioStream.pipe(res);
  } catch (err) {
    console.error("Proxy Error:", err.message);
    if (!res.headersSent) res.status(500).send("Không thể stream audio.");
  }
});

module.exports = router;
