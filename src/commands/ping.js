const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interactionOrMessage) {
        // Kiểm tra xem đây là slash command (interaction) hay message command
        const isInteraction = interactionOrMessage.isChatInputCommand?.();

        if (isInteraction) {
            // Xử lý cho slash command
            const sent = await interactionOrMessage.reply({ content: 'Pinging...', fetchReply: true });
            const latency = sent.createdTimestamp - interactionOrMessage.createdTimestamp;
            await interactionOrMessage.editReply(`Pong! Latency is ${latency}ms. API Latency is ${Math.round(interactionOrMessage.client.ws.ping)}ms`);
        } else {
            // Xử lý cho message command (!ping)
            const sent = await interactionOrMessage.reply('Pinging...');
            const latency = sent.createdTimestamp - interactionOrMessage.createdTimestamp;
            await sent.edit(`Pong! Latency is ${latency}ms. API Latency is ${Math.round(interactionOrMessage.client.ws.ping)}ms`);
        }
    },
};
