const { SlashCommandBuilder } = require("discord.js");
const play = require("play-dl");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    getVoiceConnection
} = require("@discordjs/voice");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("p")
        .setDescription("Phát nhạc từ YouTube")
        .addStringOption(opt =>
            opt.setName("query")
               .setDescription("Tên bài hoặc link")
               .setRequired(true)
        ),

    name: "p",

    async execute(messageOrInteraction, args, client) {
        // --- UNIFIED INPUT HANDLING ---
        const isSlash = messageOrInteraction.isChatInputCommand?.();
        const guild = messageOrInteraction.guild;
        const member = messageOrInteraction.member;
        const query = isSlash ? messageOrInteraction.options.getString("query") : args.join(" ");
        const reply = (msg) => {
            if (isSlash) {
                // For slash commands, we might need to defer or follow up
                if (messageOrInteraction.replied || messageOrInteraction.deferred) {
                    return messageOrInteraction.followUp(msg);
                }
                return messageOrInteraction.reply(msg);
            }
            return messageOrInteraction.reply(msg);
        };

        // --- PRE-FLIGHT CHECKS ---
        if (!query || query.trim() === "") return reply("Nhập tên bài hoặc link kìa bro 😭");
        if (!member.voice.channel) return reply("Vào voice trước bro 😎");

        // Check if bot is already playing in this guild
        if (getVoiceConnection(guild.id)) {
            return reply("Bot đang bận rồi, từ từ nhé bro!");
        }

        console.log(`[${new Date().toLocaleString()}] User ${member.user.tag} in guild ${guild.name} requested to play: "${query}"`);

        try {
            // --- SONG SEARCH ---
            const searchResults = await play.search(query, {
                limit: 1,
                source: { youtube: "video" }
            });

            if (searchResults.length === 0) {
                console.log(`[INFO] No results found for "${query}".`);
                return reply("Không tìm thấy bài 😭");
            }
            const song = searchResults[0];
            console.log(`[INFO] Found song: "${song.title}" (${song.url})`);

            // --- VOICE CONNECTION ---
            console.log(`[INFO] Joining voice channel "${member.voice.channel.name}" in guild "${guild.name}".`);
            const connection = joinVoiceChannel({
                channelId: member.voice.channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            // --- STREAMING ---
            console.log(`[INFO] Creating stream for "${song.title}"...`);
            console.log(`[INFO] Calling YouTube with URL: ${song.url}`);
            
            const streamData = await play.stream(song.url, {
                discordPlayerCompatibility: true
            });

            const resource = createAudioResource(streamData.stream, {
                inputType: streamData.type
            });

            // --- PLAYER CREATION AND EVENT HANDLING ---
            const player = createAudioPlayer();
            player.play(resource);
            connection.subscribe(player);

            await reply(`🎶 Đang phát: **${song.title}**`);

            player.on(AudioPlayerStatus.Idle, () => {
                console.log(`[INFO] Player is idle. Destroying connection in guild "${guild.name}".`);
                if (connection.state.status !== 'destroyed') {
                    connection.destroy();
                }
            });

            player.on("error", error => {
                console.error(`[ERROR] Player error in guild "${guild.name}":`, error);
                if (connection.state.status !== 'destroyed') {
                    connection.destroy();
                }
            });

        } catch (err) {
            console.error("Lỗi trong quá trình thực thi lệnh 'p':", err);
            const connection = getVoiceConnection(guild.id);
            if (connection) {
                connection.destroy();
            }
            
            if (err.code === 'ERR_INVALID_URL' || err.message?.includes('Invalid URL')) {
                await reply("⚠ Lỗi thư viện play-dl. Hãy chạy `npm install play-dl@latest` để cập nhật!").catch(console.error);
            } else {
                await reply("⚠ Đã có lỗi nghiêm trọng xảy ra! 😭").catch(console.error);
            }
        }
    }
};
