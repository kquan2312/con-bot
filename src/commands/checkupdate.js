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

async function checkPatch(client, channelId, notifyNew = false, messageToEdit = null) {
    try {
        const latestPatch = await getLatestPatch();
        let lastPatchData = { version: null };

        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf8');
            lastPatchData = JSON.parse(rawData);
        }

        if (latestPatch !== lastPatchData.version) {
            fs.writeFileSync(filePath, JSON.stringify({ version: latestPatch }, null, 2));
            if (notifyNew && client) {
                const channel = client.channels.cache.get(channelId);
                const messageContent = `📢 LMHT đã có bản cập nhật mới: **${latestPatch}**. Nhớ update nhé!     `;
                messageToEdit ? await messageToEdit.edit(messageContent) : await channel.send(messageContent);
            }
        } else if (messageToEdit) {
            await messageToEdit.edit(`✅ Không có bản cập nhật LMHT mới. Phiên bản hiện tại là **${latestPatch}**.`);
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

        let lastPatch = '0.0.0';
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            lastPatch = JSON.parse(data).version;
        }
        
        const replyMessage = await interactionOrMessage.reply({ content: 'Đang kiểm tra bản cập nhật...', fetchReply: true });
        const latestPatch = await getLatestPatch();

        const replyFunction = isInteraction ? interactionOrMessage.followUp.bind(interactionOrMessage) : interactionOrMessage.channel.send.bind(interactionOrMessage.channel);

        if (latestPatch) {
            if (latestPatch === lastPatch) {
                await replyMessage.edit(`✅ Không có bản cập nhật LMHT mới. Phiên bản hiện tại là **${latestPatch}**.`);
            } else {
                // Cập nhật file và thông báo cho người dùng
                fs.writeFileSync(filePath, JSON.stringify({ version: latestPatch }, null, 2));
                await replyMessage.edit(`🎉 Đã có bản cập nhật mới: **${latestPatch}**. Bot sẽ tự động thông báo trong những lần check sau.`);
            }
        } else {
            await replyMessage.edit('❌ Không thể lấy thông tin cập nhật.');
        }
    },
    checkPatch,
    getLatestPatch
};
