const { SlashCommandBuilder } = require("discord.js");
const axios = require("axios");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const { getMusicController, guildPlayers } = require("../utils/playerManager");

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:5053";
const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 60 seconds

// =====================
// Inactivity Timeout
// =====================
function startInactivityTimer(guildId) {
  const controller = getMusicController(guildId);
  // Clear any existing timer
  if (controller.inactivityTimer) {
    clearTimeout(controller.inactivityTimer);
  }
  controller.inactivityTimer = setTimeout(() => {
    const currentController = getMusicController(guildId);
    // Only disconnect if nothing is playing and a connection exists
    if (!currentController.isPlaying && currentController.connection) {
      console.log(`[${guildId}] Inactivity timeout: Disconnecting.`);
      currentController.connection.destroy();
      guildPlayers.delete(guildId); // Clean up the player state
    }
  }, INACTIVITY_TIMEOUT_MS);
}

// =====================
// Play bài tiếp theo trong queue
// =====================
async function playNextInQueue(guildId) {
  const controller = getMusicController(guildId);
  // Clear inactivity timer since we are trying to play something
  if (controller.inactivityTimer) clearTimeout(controller.inactivityTimer);

  if (!controller.queue.length || controller.isPlaying || !controller.connection) {
    if (!controller.queue.length && !controller.isPlaying) {
      startInactivityTimer(guildId); // Start timer if queue is empty
    }
    return;
  }

  controller.isPlaying = true;
  const song = controller.queue[0];
  const proxyUrl = `${BACKEND_URL}/proxy-audio?url=${encodeURIComponent(song.query)}`;
  const resource = createAudioResource(proxyUrl);

  if (!controller.player) {
    controller.player = createAudioPlayer();

    controller.player.on(AudioPlayerStatus.Idle, () => {
      controller.queue.shift();
      controller.isPlaying = false;
      // After a song finishes, try to play the next one or start the inactivity timer
      playNextInQueue(guildId);
    });

    controller.player.on("error", (error) => {
      console.error(`[${guildId}] Player Error:`, error.message);
      controller.queue.shift();
      controller.isPlaying = false;
      // On error, try to play the next one or start the inactivity timer
      playNextInQueue(guildId);
    });

    controller.connection.subscribe(controller.player);
  }

  controller.player.play(resource);
}

// =====================
// Command handler
// =====================
module.exports = {
  data: new SlashCommandBuilder()
    .setName("p")
    .setDescription("Phát nhạc từ SoundCloud (hỗ trợ link YT để tìm)")
    .addStringOption(opt =>
      opt.setName("query")
        .setDescription("Tên bài hoặc link YouTube")
        .setRequired(true)
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
      reply = msg => messageOrInteraction.followUp(msg);
    } else {
      reply = msg => messageOrInteraction.reply(msg);
    }

    if (!query) return reply("Nhập tên bài hoặc link đi bro 😭");
    if (!member.voice.channel) return reply("Vào voice trước bro 😎");

    const controller = getMusicController(guildId);
    controller.textChannel = textChannel;

    if (!controller.connection || controller.connection.state.status === 'destroyed') {
      controller.connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
      });

      controller.connection.on('stateChange', (oldState, newState) => {
        if (newState.status === 'destroyed') {
          guildPlayers.delete(guildId);
        }
      });
    }

    // Thêm bài vào queue
    const song = {
      title: query, // title = query (YT link hoặc tên bài)
      query,       // gửi thẳng query cho backend search
      requestedBy: member.user.tag,
    };
    controller.queue.push(song);

    // If a song is added, we are active, so clear any pending inactivity timer
    if (controller.inactivityTimer) clearTimeout(controller.inactivityTimer);

    await reply(`✅ Đã thêm vào hàng đợi: **${song.title}**`);
    playNextInQueue(guildId);
  },
};
