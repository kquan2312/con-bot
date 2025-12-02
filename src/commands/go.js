const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('go')
        .setDescription('Thông báo đến giờ chơi game và tag mọi người.'),
    async execute(interactionOrMessage) {
        const content = "@everyone đến giờ chơi game rồi";

        // Gửi tin nhắn và cho phép bot tag @everyone
        await interactionOrMessage.reply({
            content: content,
            allowedMentions: { parse: ['everyone'] } // Rất quan trọng để tag @everyone hoạt động
        });
    },
};