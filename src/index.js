require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const prefix = '!';

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
    ] 
});

client.commands = new Collection();

// Load commands
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// Load events
const eventFiles = fs.readdirSync(path.join(__dirname, 'events')).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client, prefix));
    }
}

// Start backend server
const startServer = require('./Backend/server.js');
startServer();

// Bot ready
client.once('ready', async () => {
    console.log(`🌟 Ready! Logged in as ${client.user.tag}`);

    // =====================
    // Cron check patch 11h
    // =====================
    const checkUpdateCommand = client.commands.get('checkupdate');
    cron.schedule('0 11 * * *', async () => {
        console.log(`[${new Date().toLocaleString()}] Running cron job to check for patch update...`);
        const channel = await client.channels.fetch(process.env.CHANNEL_ID).catch(console.error);
        if (channel) {
            const messageToEdit = await channel.send('Đang kiểm tra bản cập nhật...').catch(console.error);
            checkUpdateCommand.checkPatch(client, process.env.CHANNEL_ID, true, messageToEdit);
        }
    }, { timezone: 'Asia/Ho_Chi_Minh' });

    // =====================
    // Cron checkWeather 7h,16h,21h
    // =====================
    cron.schedule('0 7,16,21 * * *', async () => {
        console.log(`[${new Date().toLocaleString()}] Cron: !checkWeather hanoi`);

        const channel = await client.channels.fetch(process.env.CHANNEL_ID).catch(console.error);
        if (!channel) return console.log('Channel not found');

        // Fake message giống user gửi
        const fakeMessage = {
            content: `${prefix}checkWeather hanoi`,
            author: client.user, // bot tự gửi
            channel,
            guild: channel.guild,
            isCron: true,
            reply: (msg) => channel.send(msg),
        };

        // Gọi event messageCreate
        const event = client.listeners(Events.MessageCreate)[0];
        if (event) event(fakeMessage);
    }, { timezone: 'Asia/Ho_Chi_Minh' });
});

// Login bot
client.login(process.env.BOT_TOKEN);
