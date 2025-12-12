// commands/resume.js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  // Slash command
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Tiếp tục phát bài hát đang tạm dừng"),

  // Text command
  name: "resume",
  description: "Tiếp tục phát bài hát đang tạm dừng",

  async execute(messageOrInteraction, args, client) {
    const isSlash = messageOrInteraction.isChatInputCommand?.();
    const guildId = messageOrInteraction.guild.id;

    const { getMusicController } = require("../utils/playerManager");
    const controller = getMusicController(guildId);

    if (!controller || !controller.player) {
      const msg = "Không có bài nào để tiếp tục phát 😭";
      return isSlash
        ? messageOrInteraction.reply(msg)
        : messageOrInteraction.channel.send(msg);
    }

    // Check state
    const status = controller.player.state.status;
    if (status !== "paused") {
      const msg = "Nhạc có bị pause đâu mà resume bro 😭";
      return isSlash
        ? messageOrInteraction.reply(msg)
        : messageOrInteraction.channel.send(msg);
    }

    try {
      controller.player.unpause();

      const msg = "▶️ Nhạc đã được tiếp tục!";
      return isSlash
        ? messageOrInteraction.reply(msg)
        : messageOrInteraction.channel.send(msg);

    } catch (err) {
      console.error(`[${guildId}] Resume error:`, err);
      const msg = "❌ Không thể resume bài này 😭";
      return isSlash
        ? messageOrInteraction.reply(msg)
        : messageOrInteraction.channel.send(msg);
    }
  },
};
