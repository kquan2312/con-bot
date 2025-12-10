const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client, prefix) {
        // Bỏ qua nếu tin nhắn từ bot hoặc không bắt đầu bằng prefix
        if (message.author.bot || !message.content.startsWith(prefix)) return;

        // Tách lệnh và các tham số
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);

        if (!command) return;

        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(`Lỗi khi chạy lệnh (message) "${commandName}":`, error);
            await message.reply('Đã xảy ra lỗi khi chạy lệnh này!');
        }
    },
};