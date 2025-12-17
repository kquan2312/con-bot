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
         GatewayIntentBits.GuildVoiceStates, // thêm dòng này
        GatewayIntentBits.GuildMembers,     // nên thêm để log join/leave server
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
cron.schedule('0 11 * * *', async () => { // Thay đổi: Chạy 11 sáng mỗi ngày
    // Thêm log để dễ dàng theo dõi
    const logMessage = `[${new Date().toLocaleString()}] Running cron job to check for patch update...`;
    console.log(logMessage);
    // Gửi tin nhắn đến channel khi cron job bắt đầu
    const channel = client.channels.cache.get(process.env.CHANNEL_ID);
    if (channel) { // Gửi tin nhắn "Đang kiểm tra..." và lấy đối tượng message
        const messageToEdit = await channel.send('Đang kiểm tra bản cập nhật...').catch(console.error);
        // Truyền message vào hàm checkPatch để chỉnh sửa sau
        checkUpdateCommand.checkPatch(client, process.env.CHANNEL_ID, true, messageToEdit);
    }
});
const checkUpdateWeather = client.commands.get('checkWeather');

cron.schedule(
    '0 7,16,21 * * *',
    async () => {
        const logMessage = `[${new Date().toLocaleString()}] Running cron job to check for weather update...`;
        console.log(logMessage);

        const channel = client.channels.cache.get(process.env.CHANNEL_ID);
        if (channel) {
            const messageToEdit = await channel
                .send('🌤️ Đang kiểm tra cập nhật tự độngthời tiết...')
                .catch(console.error);

            // Gọi đúng command checkWeather
            checkUpdateWeather.checkWeather(
                client,
                process.env.CHANNEL_ID,
                true,
                messageToEdit
            );
        }
    },
    {
        timezone: 'Asia/Ho_Chi_Minh',
    }
);


const startServer = require('./Backend/server.js'); // Đường dẫn trỏ tới file vừa tạo
startServer();


client.login(process.env.BOT_TOKEN);
