const { Events, AuditLogEvent } = require('discord.js');

require("dotenv").config();

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        try {
            // Lấy CHANNEL_ID từ biến môi trường (đảm bảo file .env có CHANNEL_ID=...)
            const LOG_CHANNEL_ID = process.env.CHANNEL_ID;
            if (!LOG_CHANNEL_ID) return;

            const channel = newMember.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (!channel) return;

            // 1. Kiểm tra thay đổi Nickname
            if (oldMember.nickname !== newMember.nickname) {
                let executor = null;
                try {
                    await new Promise(r => setTimeout(r, 1000)); // Delay 1s để Audit Log kịp cập nhật
                    // Sử dụng AuditLogEvent.MemberUpdate thay vì string cứng
                    const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 5 });
                    const entry = logs.entries.find(e => e.target.id === newMember.id && e.changes.some(c => c.key === 'nick'));
                    if (entry) executor = entry.executor;
                } catch (e) {
                    console.error("Lỗi lấy audit log:", e);
                }

                const oldNick = oldMember.nickname || "Mặc định";
                const newNick = newMember.nickname || "Mặc định";
                
                if (executor) {
                    channel.send(`✏️ **${executor.tag}** đổi nickname của **${newMember.user.tag}**: \`${oldNick}\` → \`${newNick}\``);
                } else {
                    channel.send(`✏️ Nickname của **${newMember.user.tag}** thay đổi: \`${oldNick}\` → \`${newNick}\``);
                }
            }

            // 2. Kiểm tra thay đổi Role
            const oldRoles = oldMember.roles.cache.map(r => r.id);
            const newRoles = newMember.roles.cache.map(r => r.id);
            const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
            const removedRoles = oldRoles.filter(r => !newRoles.includes(r));

            if (addedRoles.length || removedRoles.length) {
                let executorTag = null;
                try {
                    await new Promise(r => setTimeout(r, 1000));
                    const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 5 });
                    const entry = logs.entries.find(e => e.target.id === newMember.id);
                    if (entry) executorTag = entry.executor.tag;
                } catch (e) {}

                let msg = executorTag 
                    ? `🔧 **${executorTag}** cập nhật roles của **${newMember.user.tag}**: `
                    : `🔧 Roles của **${newMember.user.tag}** thay đổi: `;

                if (addedRoles.length) msg += `+${addedRoles.map(r => newMember.guild.roles.cache.get(r)?.name).join(", ")} `;
                if (removedRoles.length) msg += `-${removedRoles.map(r => newMember.guild.roles.cache.get(r)?.name).join(", ")}`;
                channel.send(msg);
            }

            // 3. Kiểm tra thay đổi Avatar
            if (oldMember.user.avatar !== newMember.user.avatar) {
                channel.send(`🖼️ **${newMember.user.tag}** vừa đổi avatar`);
            }

        } catch (err) {
            console.error("GuildMemberUpdate Error:", err);
        }
    }
};
