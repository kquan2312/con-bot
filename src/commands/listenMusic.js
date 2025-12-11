const { SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const PORT = 5053;

const play = require("play-dl");

// FFmpeg từ ffmpeg-static
try {
  const ffmpegPath = require("ffmpeg-static");
  process.env.FFMPEG_PATH = ffmpegPath;
} catch (e) {
  console.warn("⚠️ Chưa cài ffmpeg-static");
}

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection,
} = require("@discordjs/voice");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("p")
    .setDescription("Phát nhạc từ YouTube")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("Tên bài hoặc link YouTube")
        .setRequired(true)
    ),
  name: "p",

  async execute(messageOrInteraction, args = [], client) {
    const isSlash = messageOrInteraction.isChatInputCommand?.();
    const guild = messageOrInteraction.guild;
    const member = messageOrInteraction.member;
    const query = isSlash
      ? messageOrInteraction.options.getString("query")
      : args.join(" ");

    const reply = async (msg) => {
      if (isSlash) {
        if (messageOrInteraction.replied || messageOrInteraction.deferred)
          return messageOrInteraction.followUp(msg);
        return messageOrInteraction.reply(msg);
      }
      return messageOrInteraction.reply(msg);
    };

    console.log("══════════════════════════════════");
    console.log(`📥 NEW REQUEST at ${new Date().toLocaleString()}`);
    console.log(`👤 User: ${member.user.tag}`);
    console.log(`🔎 Query input:`, query);
    console.log("══════════════════════════════════");

    if (!query) return reply("Nhập tên bài hoặc link đi bro 😭");
    if (!member.voice.channel) return reply("Vào voice trước bro 😎");

    const existingConn = getVoiceConnection(guild.id);
    if (existingConn) {
      return reply("Bot đang phát bài khác rồi bro!");
    }

    try {
      let url = query;

      // STEP 1 — Validate or Search
      console.log("🔍 Step 1: Check URL or Search");

      if (play.yt_validate(query) !== "video") {
        console.log("❌ Không phải URL, search…");

        const results = await play.search(query, { limit: 1 });
        if (!results || results.length === 0) {
          return reply("Không tìm thấy bài này 😭");
        }

        url = results[0].url;
      }

      console.log("🎯 Final URL:", url);

      // STEP 2 — Get info
      console.log("🔎 Step 2: Lấy video info…");

      const info = await play.video_info(url);
      const title = info.video_details.title;

      console.log("📌 Video title:", title);
      console.log("📌 Duration:", info.video_details.durationInSec, "sec");

      // STEP 3 — Lấy audio-only stream
      console.log("🎧 Step 3: Lấy audio-only stream…");

      let audioStreams = info.format.filter(
        (f) => f.has_audio && !f.has_video && f.url
      );

      if (!audioStreams.length) {
        audioStreams = info.format.filter((f) => f.has_audio && f.url);
      }

      if (!audioStreams || audioStreams.length === 0) {
        console.log("❌ Không có audio-only stream");
        return reply("Không lấy được audio-only stream 😭");
      }

      const audioStream = audioStreams[audioStreams.length - 1];
      const streamUrl = audioStream.url;

      console.log("🎵 Audio Stream URL:", streamUrl);

      // STEP 4 — Build Proxy URL
      const proxyUrl = `http://127.0.0.1:${PORT}/proxy-audio?url=${encodeURIComponent(
        streamUrl
      )}`;

      console.log("🔗 Proxy URL:", proxyUrl);

      const resource = createAudioResource(proxyUrl);

      // STEP 5 — Join Voice
      console.log("🔊 Step 4: Join VC");

      const connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });

      // Player
      console.log("▶ Step 5: Play audio");

      const player = createAudioPlayer();
      connection.subscribe(player);
      player.play(resource);

      await reply(`🎶 Đang phát: **${title}**`);

      // Auto disconnect
      player.on(AudioPlayerStatus.Idle, () => {
        console.log("⏹ Player idle → destroy connection");
        if (connection.state.status !== "destroyed") connection.destroy();
      });

      player.on("error", (err) => {
        console.log("🔥 Player ERROR:", err);
        if (connection.state.status !== "destroyed") connection.destroy();
      });
    } catch (err) {
      console.log("🔥🔥🔥 FATAL ERROR 🔥🔥🔥");
      console.error(err);

      const conn = getVoiceConnection(guild.id);
      if (conn) conn.destroy();

      reply("Có lỗi khi phát nhạc 😭");
    }
  },
};
