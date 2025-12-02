const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

const filePath = path.join(__dirname, '../../lastPatch.json');

async function getLatestPatch() {
    const res = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = res.data;
    return versions[0];
}

async function checkPatch(client, channelId, notify = false) {
    try {
        const latestPatch = await getLatestPatch();

        let lastPatch = null;
        // let lastPatch = null;
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            lastPatch = JSON.parse(lastPatchData).version;
        }

        // Nếu có bản vá mới, gửi thông báo
        if (latestPatch !== lastPatch && notify && client) {
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                await channel.send(`📢 LMHT đã có bản cập nhật mới: **${latestPatch}**. Nhớ update nhé!`);
            }
        }

        if (latestPatch !== lastPatch) {
            if (notify && client) {
                const channel = client.channels.cache.get(channelId);
                if (channel) {
                    channel.send(`📢 LMHT đã có bản cập nhật mới: **${latestPatch}**. Nhớ update nhé!`);
                }
            }
            fs.writeFileSync(filePath, JSON.stringify({ version: latestPatch }, null, 2));
        }

        return latestPatch;
    } catch (err) {
        console.error('Lỗi khi check patch:', err);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkupdate')
        .setDescription('Kiểm tra bản cập nhật LMHT mới nhất.'),
    async execute(interactionOrMessage) {
        const isInteraction = interactionOrMessage.isChatInputCommand?.();
        const client = interactionOrMessage.client;

        let lastPatch = '0.0.0';
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            lastPatch = JSON.parse(data).version;
        }

        await interactionOrMessage.reply('Đang kiểm tra bản cập nhật...');
        const latestPatch = await getLatestPatch();

        if (latestPatch) {
            if (latestPatch === lastPatch) {
                await interactionOrMessage.followUp(`Không có bản cập nhật mới. Phiên bản hiện tại là **${latestPatch}**.`);
            } else {
                // Cập nhật file và thông báo cho người dùng
                fs.writeFileSync(filePath, JSON.stringify({ version: latestPatch }, null, 2));
                await interactionOrMessage.followUp(`Đã có bản cập nhật mới: **${latestPatch}**. Bot sẽ tự động thông báo trong những lần check sau.`);
            }
        } else {
            await interactionOrMessage.followUp('Không thể lấy thông tin cập nhật.');
        }
    },
    checkPatch,
    getLatestPatch
};
