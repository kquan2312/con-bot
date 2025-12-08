require('dotenv').config(); // Tải các biến môi trường từ file .env
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const API_KEY = process.env.LMSS_API_KEY; // Lấy API key từ biến môi trường

const axiosInstance = axios.create({
    headers: { 'User-Agent': 'ConBot/1.0' } // Thêm User-Agent để tránh bị chặn
});

async function getRankInfo(summonerName) {
    if (!API_KEY) {
        console.error('LMSS_API_KEY chưa được thiết lập trong biến môi trường.');
        return { success: false, error: 'Lỗi cấu hình phía bot: API Key chưa được thiết lập.' };
    }

    try {
        const encodedName = encodeURIComponent(summonerName);

        // 1️⃣ Lấy info summoner
        const summonerRes = await axiosInstance.get(
            `https://lmssplus.org/api/riot/v3/summoners/by-name?name=${encodedName}&region=VN2&api_key=${API_KEY}`
        );
        const { puuid, summonerName: displayName, server } = summonerRes.data;

        // 2️⃣ Lấy tất cả rank chỉ với 1 request
        const rankRes = await axiosInstance.get(
            `https://lmssplus.org/api/riot/v1/rank/new/${server}/RANKED_SOLO_5x5/${puuid}`
        );

        const queues = [];

        if (rankRes.data && rankRes.data.length > 0) {
            rankRes.data.forEach(q => {
                queues.push({
                    queueType: q.queueType === 'RANKED_SOLO_5x5' ? 'Đơn/Đôi' : 'Linh Hoạt',
                    tier: q.tier,
                    rank: q.rank,
                    lp: q.leaguePoints,
                    wins: q.wins,
                    losses: q.losses,
                    winrate: q.wins + q.losses > 0 ? ((q.wins / (q.wins + q.losses)) * 100).toFixed(2) + '%' : 'N/A'
                });
            });
        }

        return { success: true, summoner: displayName, server, queues };
    } catch (err) {
        // Log lỗi chi tiết hơn để debug trên Railway
        console.error('Đã xảy ra lỗi khi gọi API LMSS+:', {
            message: err.message,
            response: err.response ? { status: err.response.status, data: err.response.data } : 'Không có phản hồi từ server'
        });
        if (err.response && err.response.status === 404) return { success: false, error: 'Không tìm thấy người chơi này!' };
        return { success: false, error: 'Có lỗi xảy ra khi lấy thông tin rank. Vui lòng thử lại sau.' };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Kiểm tra rank LMHT của một người chơi (dữ liệu từ LMSS+).')
        .addStringOption(option =>
            option.setName('summonername')
                .setDescription('Tên người chơi (ví dụ: ABC#1234)')
                .setRequired(true)),

    async execute(interactionOrMessage, args = []) {
        const isInteraction = interactionOrMessage.isChatInputCommand?.();
        let summonerName;

        if (isInteraction) {
            await interactionOrMessage.deferReply();
            summonerName = interactionOrMessage.options.getString('summonername').trim();
        } else {
            summonerName = args.join(" ");
            if (!summonerName) return interactionOrMessage.reply("Bạn phải nhập tên người chơi!");
        }

        const rankData = await getRankInfo(summonerName);
        const replyFn = isInteraction ? interactionOrMessage.editReply.bind(interactionOrMessage) : interactionOrMessage.reply.bind(interactionOrMessage);

        if (!rankData.success) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Lỗi')
                .setDescription(rankData.error);
            return replyFn({ content: '', embeds: [errorEmbed] });
        }

        const successEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Thông tin Rank của ${rankData.summoner}`)
            .setTimestamp()
            .setFooter({ text: 'Dữ liệu từ LMSS+' });

        if (rankData.queues.length > 0) {
            const fields = rankData.queues.map(q => ({
                name: `Bảng xếp hạng: ${q.queueType}`,
                value: `**${q.tier} ${q.rank}** - **${q.lp} LP**\nThắng: ${q.wins} | Thua: ${q.losses}\nTỉ lệ thắng: **${q.winrate}**`,
                inline: true
            }));
            successEmbed.addFields(fields);
        } else {
            successEmbed.setDescription('Người chơi này chưa có rank trong mùa hiện tại.');
        }

        await replyFn({ content: '', embeds: [successEmbed] });
    },
};
