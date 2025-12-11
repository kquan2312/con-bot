const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const { guildPlayers } = require("../utils/playerManager");

module.exports = {
    // ---- SLASH COMMAND ----
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Dừng phát nhạc và rời kênh voice"),

    name: "stop", // ---- PREFIX COMMAND ----

    async execute(messageOrInteraction, args, client) {
        let isSlash = false;
        let guild;
        let reply;

        // Xác định loại lệnh
        if (messageOrInteraction.isChatInputCommand?.()) {
            isSlash = true;
            const interaction = messageOrInteraction;
            guild = interaction.guild;
            reply = (msg) => interaction.reply(msg);
        } else {
            const message = messageOrInteraction;
            guild = message.guild;
            reply = (msg) => message.reply(msg);
        }

        // Lấy connection của server hiện tại
        const connection = getVoiceConnection(guild.id);

        if (!connection)
            return reply("Bot có bật nhạc đâu bro 😭");

        // Dọn dẹp controller của guild
        guildPlayers.delete(guild.id);

        connection.destroy();

        reply("🛑 Đã dừng nhạc và rời voice nha bro 😎");
    },
};
