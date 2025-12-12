const { SlashCommandBuilder } = require('discord.js');
const { sessions } = require('../commands/ChatAi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetgpt')
    .setDescription('Xoá toàn bộ hội thoại với AI'),

  name: 'resetgpt',
  description: 'Reset hội thoại GPT',

  async execute(interaction, args) {
    const isInteraction = typeof interaction.deferReply !== 'undefined';
    const userId = isInteraction
      ? interaction.user.id        // slash command
      : interaction.author.id;     // message command

    // Nếu là message command thì show typing cho ngầu 😎
    if (!isInteraction) {
      await interaction.channel.sendTyping();
    }

    if (sessions[userId]) {
      delete sessions[userId];

      const msg = "🧹 **Done bro!** Reset hội thoại rồi nha. Fresh như tình đầu 💖";

      return isInteraction
        ? interaction.reply(msg)
        : interaction.reply(msg);
    }

    const msg = "😢 Bro chưa chat gì với AI luôn á, reset cái gì trời?";

    return isInteraction
      ? interaction.reply(msg)
      : interaction.reply(msg);
  },
};
