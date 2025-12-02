const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRankInfo } = require("../utils/lmssScraper");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Kiểm tra rank LMHT của một người chơi từ LMSS+.')
        .addStringOption(option =>
            option.setName('summonername')
                .setDescription('Tên người chơi bạn muốn kiểm tra')
                .setRequired(true)),

    async execute(interactionOrMessage, args = []) {
        const isInteraction = interactionOrMessage.isChatInputCommand?.();
        let summonerName;

        if (isInteraction) {
            summonerName = interactionOrMessage.options.getString('summonername');
        } else {
            summonerName = args.join(" ");
            if (!summonerName) {
                return interactionOrMessage.reply("Bạn phải nhập tên summoner nha! (ví dụ: `!rank BADASSATRON#VN23`)");
            }
        }

        const sentMessage = await interactionOrMessage.reply({
            content: `Đang tìm thông tin rank của **${summonerName}**...`,
            fetchReply: true
        });

        const rankData = await getRankInfo(summonerName);

        if (!rankData.success) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Lỗi')
                .setDescription(rankData.error);
            return sentMessage.edit({ content: '', embeds: [errorEmbed] });
        }

        const successEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Thông tin Rank của ${rankData.summoner}`)
            .setTimestamp()
            .setFooter({ text: 'Dữ liệu từ LMSS+' });

        rankData.queues.forEach(q => {
            successEmbed.addFields({
                name: q.queueType,
                value: `Rank: **${q.tier} ${q.rank}**\nLP: **${q.lp}**\nWinrate: **${q.winrate}**`
            });
        });

        await sentMessage.edit({ content: '', embeds: [successEmbed] });
    },
};
