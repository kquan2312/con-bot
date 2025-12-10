const { Client, GatewayIntentBits } = require("discord.js");

module.exports = {
    name: "voiceStateUpdate",

    execute(oldState, newState, client) {
        const user = newState.member;

        // JOIN voice
        if (!oldState.channelId && newState.channelId) {
            const channel = newState.guild.systemChannel;
            if (channel) {
                channel.send(`🎧 <@${user.id}> vừa join voice **${newState.channel.name}** 🔊`);
            }
        }

        // LEAVE voice
        if (oldState.channelId && !newState.channelId) {
            const channel = oldState.guild.systemChannel;
            if (channel) {
                channel.send(`💨 <@${user.id}> vừa rời voice **${oldState.channel.name}** :<`);
            }
        }

        // MOVE voice
        if (
            oldState.channelId &&
            newState.channelId &&
            oldState.channelId !== newState.channelId
        ) {
            const channel = newState.guild.systemChannel;
            if (channel) {
                channel.send(
                    `🔄 <@${user.id}> chuyển từ **${oldState.channel.name}** → **${newState.channel.name}**`
                );
            }
        }
    },
};


