// commands/p.js
const { SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const play = require("play-dl");
const scdl = require("soundcloud-downloader").default;
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection,
} = require("@discordjs/voice");
const { getMusicController, guildPlayers } = require("../utils/playerManager");

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:5053";
const SC_CLIENT_ID = process.env.SOUND_CLOUD_CLIENT_ID;

// -----------------------------------------------------------------------------
// Lấy stream mạnh mẽ (retry nếu YT)
async function getBestAudioStream(videoUrl) {
  try {
    const info = await play.video_info(videoUrl);
    const stream = info.format
      .filter((f) => f.has_audio && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    return stream;
  } catch {
    await play.refreshToken();
    const info = await play.video_info(videoUrl);
    const stream = info.format
      .filter((f) => f.has_audio && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    return stream;
  }
}

// -----------------------------------------------------------------------------
// Phát bài tiếp theo trong queue
async function playNextInQueue(guildId) {
  const controller = getMusicController(guildId);
  if (controller.queue.length === 0 || !controller.connection) return;

  const song = controller.queue[0];
  controller.isPlaying = true;

  try {
    console.log(`[${guildId}] 🔊 Streaming: ${song.title}`);

    // Proxy backend
    const proxyUrl = `${BACKEND_URL}/proxy-audio?url=${encodeURIComponent(song.streamUrl)}`;
    const resource = createAudioResource(proxyUrl, {
      inlineVolume: true
    });

    // Xử lý lỗi khi resource không thể phát (ví dụ: stream từ backend bị ngắt)
    resource.playStream.on('error', error => {
      console.error(`[${guildId}] Error on audio resource:`, error.message);
      controller.player.emit(AudioPlayerStatus.Idle); // Giả lập trạng thái Idle để chuyển bài
    });

    if (!controller.player) {
      controller.player = createAudioPlayer();
      controller.connection.subscribe(controller.player);

      controller.player.on(AudioPlayerStatus.Idle, () => {
        controller.queue.shift();
        controller.isPlaying = false;
        if (controller.queue.length > 0) playNextInQueue(guildId);
        else {
          setTimeout(() => {
            const c = getMusicController(guildId);
            if (!c.isPlaying && c.connection) {
              c.connection.destroy();
              guildPlayers.delete(guildId);
            }
          }, 60 * 1000);
        }
      });

      controller.player.on("error", (err) => {
        console.error(`[${guildId}] Player Error:`, err);
        controller.queue.shift();
        controller.isPlaying = false;
        if (controller.queue.length > 0) playNextInQueue(guildId);
      });
    }

    controller.player.play(resource);
    await controller.textChannel.send(`🎶 Đang phát: **${song.title}**`);
  } catch (err) {
    console.error(`[${guildId}] Error playing song:`, err);
    controller.queue.shift();
    controller.isPlaying = false;
    if (controller.queue.length > 0) playNextInQueue(guildId);
  }
}

// -----------------------------------------------------------------------------
// Command !p
// -----------------------------------------------------------------------------
module.exports = {
  data: new SlashCommandBuilder()
    .setName("p")
    .setDescription("Phát nhạc từ YouTube hoặc SoundCloud")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("Tên bài hoặc link").setRequired(true)
    ),
  name: "p",

  async execute(messageOrInteraction, args = [], client) {
    const isSlash = messageOrInteraction.isChatInputCommand?.();
    const guild = messageOrInteraction.guild;
    const guildId = guild.id;
    const member = messageOrInteraction.member;
    const textChannel = messageOrInteraction.channel;

    const query = isSlash
      ? messageOrInteraction.options.getString("query")
      : args.join(" ");

    let reply;
    if (isSlash) {
      await messageOrInteraction.deferReply();
      reply = (msg) => messageOrInteraction.followUp(msg);
    } else reply = (msg) => messageOrInteraction.reply(msg);

    if (!query) return reply("Nhập tên bài hoặc link đi bro 😭");
    if (!member.voice.channel) return reply("Vào voice trước bro 😎");

    const controller = getMusicController(guildId);
    controller.textChannel = textChannel;

    if (!controller.connection || controller.connection.state.status === "destroyed") {
      controller.connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
      });
      controller.connection.on("stateChange", (oldState, newState) => {
        if (newState.status === "destroyed") guildPlayers.delete(guildId);
      });
    }

    try {
      let trackUrl, title, streamUrl;

      if (query.startsWith("https://soundcloud.com/")) {
        trackUrl = query;
        title = query.split("/").pop(); // fallback
        streamUrl = trackUrl;
      } else if (play.yt_validate(query) === "video") {
        const info = await play.video_info(query);
        title = info.video_details.title;
        const stream = await getBestAudioStream(info.video_details.url);
        streamUrl = stream.url;
      } else {
        // Search SoundCloud public track
        const searchResults = await scdl.search({
          query,
          resourceType: "tracks",
          limit: 1,
        });
        if (!searchResults?.collection?.length)
          return reply("Không tìm thấy track, thử dùng link trực tiếp");

        const track = searchResults.collection[0];
        trackUrl = track.permalink_url;
        title = track.title;
        streamUrl = trackUrl;
      }

      controller.queue.push({
        title,
        url: trackUrl,
        streamUrl,
        requestedBy: member.user.tag,
      });

      await reply(`✅ Đã thêm vào hàng đợi: **${title}**`);
      if (!controller.isPlaying) playNextInQueue(guildId);
    } catch (err) {
      console.error(`[${guildId}] Lỗi lệnh !p:`, err);
      reply("Có lỗi xảy ra khi xử lý yêu cầu 😭");
    }
  },
};
