require('dotenv').config();
const cron = require('node-cron');

const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const prefix = '!'; // Định nghĩa prefix cho lệnh

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, // Thêm quyền đọc tin nhắn trong server
        GatewayIntentBits.MessageContent, // Thêm quyền đọc nội dung tin nhắn
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
    }
    else {
        // Truyền thêm prefix cho các sự kiện không phải 'once'
        client.on(event.name, (...args) => event.execute(...args, client, prefix));
    }
}
// Cron job check patch mỗi giờ
const checkUpdateCommand = client.commands.get('checkupdate');
cron.schedule('0 * * * *', () => {
    checkUpdateCommand.checkPatch(client, process.env.CHANNEL_ID, true);
});

client.login(process.env.BOT_TOKEN);
