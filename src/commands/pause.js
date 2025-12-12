// commands/pause.js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  // Dùng cho slash command
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Tạm dừng bài hát đang phát"),

  // Dùng cho text command
  name: "pause",
  description: "Tạm dừng bài hát đang phát",

  // Hàm execute chung cho cả 2 loại command
  async execute(messageOrInteraction, args, client) {
    const isSlash = messageOrInteraction.isChatInputCommand?.();
    const guildId = messageOrInteraction.guild.id;
    const member = messageOrInteraction.member;

    const { getMusicController } = require("../utils/playerManager");
    const controller = getMusicController(guildId);
    if (!controller || !controller.player) {
      const msg = "Hiện tại không có bài hát nào đang phát!";
      return isSlash
        ? await messageOrInteraction.reply(msg)
        : await messageOrInteraction.channel.send(msg);
    }

    if (controller.player.state.status !== "playing") {
      const msg = "Nhạc đang không phát hoặc đã tạm dừng!";
      return isSlash
        ? await messageOrInteraction.reply(msg)
        : await messageOrInteraction.channel.send(msg);
    }

    try {
      controller.player.pause();
      const msg = "✅ Đã tạm dừng nhạc! ⏸️";
      return isSlash
        ? await messageOrInteraction.reply(msg)
        : await messageOrInteraction.channel.send(msg);
    } catch (err) {
      console.error(`[${guildId}] Lỗi khi pause nhạc:`, err);
      const msg = "❌ Không thể tạm dừng nhạc 😭";
      return isSlash
        ? await messageOrInteraction.reply(msg)
        : await messageOrInteraction.channel.send(msg);
    }
  },
};
