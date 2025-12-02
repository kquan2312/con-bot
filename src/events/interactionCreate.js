const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.warn(`⚠ Lệnh "${interaction.commandName}" không tồn tại`);
            await interaction.reply({ content: `Lệnh \`${interaction.commandName}\` không tồn tại`, ephemeral: true });
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Lỗi khi chạy lệnh "${interaction.commandName}":`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Đã xảy ra lỗi khi chạy lệnh này!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Đã xảy ra lỗi khi chạy lệnh này!', ephemeral: true });
            }
        }
    },
};
