const { SlashCommandBuilder } = require("discord.js");
const { getMusicController } = require("../utils/playerManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Bỏ qua bài hát hiện tại và phát bài tiếp theo"),
  name: "skip",
  description: "Bỏ qua bài hát hiện tại và phát bài tiếp theo",

  async execute(messageOrInteraction, args = [], client) {
    const guildId = messageOrInteraction.guildId;
    const controller = getMusicController(guildId);

    if (!controller.player || !controller.isPlaying) {
      return messageOrInteraction.reply("Có bài nào đang phát đâu mà skip bro? 😅");
    }

    controller.player.stop();
    return messageOrInteraction.reply("⏭️ Đã skip sang bài tiếp theo!");
  },
};
