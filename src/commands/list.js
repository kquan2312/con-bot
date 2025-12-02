const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Hiển thị danh sách tất cả các lệnh có sẵn.'),
    async execute(interactionOrMessage) {
        // Lấy collection các lệnh từ client
        const { commands } = interactionOrMessage.client;

        // Tạo một Embed để hiển thị danh sách lệnh cho đẹp
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Danh sách các lệnh')
            .setDescription('Dưới đây là tất cả các lệnh bạn có thể sử dụng:');

        // Thêm từng lệnh vào embed
        commands.forEach(command => {
            embed.addFields({ name: `\`/${command.data.name}\``, value: command.data.description });
        });

        // Gửi embed dưới dạng phản hồi
        await interactionOrMessage.reply({ embeds: [embed] });
    },
};