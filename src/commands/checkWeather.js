const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// Bạn nên lưu trữ token này trong file .env để bảo mật hơn
const WEATHER_API_TOKEN = process.env.WEATHER_API_TOKEN || 'db49057747b00b5a079f1e90e35bc0db2c924541';
const API_URL = `https://api.waqi.info/feed/vietnam/ha-noi/chi-cuc-bvmt/?token=${WEATHER_API_TOKEN}`;

/**
 * Lấy thông tin chất lượng không khí (AQI) và diễn giải nó.
 * @param {number} aqi - Chỉ số chất lượng không khí.
 * @returns {object} - Chứa màu sắc và mô tả cho chỉ số AQI.
 */
function getAqiInfo(aqi) {
    if (aqi <= 50) return { color: 0x00E400, description: 'Tốt' };
    if (aqi <= 100) return { color: 0xFFFF00, description: 'Trung bình' };
    if (aqi <= 150) return { color: 0xFF7E00, description: 'Không lành mạnh cho nhóm nhạy cảm' };
    if (aqi <= 200) return { color: 0xFF0000, description: 'Không lành mạnh' };
    if (aqi <= 300) return { color: 0x8F3F97, description: 'Rất không lành mạnh' };
    return { color: 0x7E0023, description: 'Nguy hiểm' };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkweather')
        .setDescription('Kiểm tra thời tiết và chất lượng không khí tại vị trí hiện tại.'),
    async execute(interactionOrMessage) {
        const sentMessage = await interactionOrMessage.reply({
            content: 'Đang lấy thông tin thời tiết...',
            fetchReply: true
        });

        try {
            const response = await axios.get(API_URL);
            const { data } = response.data;

            if (response.data.status !== 'ok' || !data) {
                throw new Error('Không nhận được dữ liệu hợp lệ từ API.');
            }

            const aqi = data.aqi;
            const aqiInfo = getAqiInfo(aqi);
            const city = data.city.name;
            const temperature = data.iaqi.t?.v;
            const humidity = data.iaqi.h?.v;
            const pressure = data.iaqi.p?.v;
            const wind = data.iaqi.w?.v;
            const time = new Date(data.time.s).toLocaleString('vi-VN');

            const weatherEmbed = new EmbedBuilder()
                .setColor(aqiInfo.color)
                .setTitle(`Thời tiết tại ${city}`)
                .setDescription(`Cập nhật lúc: ${time}`)
                .addFields(
                    { name: 'Chất lượng không khí (AQI)', value: `**${aqi}** - ${aqiInfo.description}`, inline: false },
                    { name: '🌡️ Nhiệt độ', value: temperature ? `${temperature}°C` : 'N/A', inline: true },
                    { name: '💧 Độ ẩm', value: humidity ? `${humidity}%` : 'N/A', inline: true },
                    { name: '💨 Gió', value: wind ? `${wind} m/s` : 'N/A', inline: true },
                    { name: '📊 Áp suất', value: pressure ? `${pressure} hPa` : 'N/A', inline: true }
                )
                .setFooter({ text: 'Dữ liệu từ World Air Quality Index Project' });

            await sentMessage.edit({ content: '', embeds: [weatherEmbed] });

        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu thời tiết:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Lỗi')
                .setDescription('Không thể lấy thông tin thời tiết vào lúc này. Vui lòng thử lại sau.');
            await sentMessage.edit({ content: '', embeds: [errorEmbed] });
        }
    },
};