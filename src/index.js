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

// =====================
// READY event
// =====================
client.once('ready', async () => {
    console.log(`🌟 Ready! Logged in as ${client.user.tag}`);

    // ---------------------
    // TEST cron ngay sau deploy
    // ---------------------
    // await runWeatherCron();

    // ---------------------
    // Cron chính checkWeather 7h/16h/21h
    // ---------------------
    cron.schedule('0 7,16,21 * * *', runWeatherCron, { timezone: 'Asia/Ho_Chi_Minh' });
     cron.schedule( "1 11 * * *",
  async () => {
    await runCheckinGICron();
  },
  {
    timezone: "Asia/Ho_Chi_Minh",
  }
);

    // ---------------------
    // Cron check patch 11h
    // ---------------------
    const checkUpdateCommand = client.commands.get('checkupdate');
    cron.schedule('0 11 * * *', async () => {
        console.log(`[${new Date().toLocaleString()}] Running cron job to check for patch update...`);
        const channel = await client.channels.fetch(process.env.CHANNEL_ID).catch(console.error);
        if (channel) {
            const messageToEdit = await channel.send('Đang kiểm tra bản cập nhật...').catch(console.error);
            checkUpdateCommand.checkPatch(client, process.env.CHANNEL_ID, true, messageToEdit);
        }
    }, { timezone: 'Asia/Ho_Chi_Minh' });
});

// =====================
// Function chạy cron checkWeather
// =====================
async function runWeatherCron() {
    const commandName = 'checkweather';
    const command = client.commands.get(commandName);

    if (!command) {
        console.error(`[Cron Error] Command '${commandName}' not found.`);
        return;
    }
    
    console.log(`[${new Date().toLocaleString()}] Cron: Running '${commandName}' for 'hanoi'.`);

    const channel = await client.channels.fetch(process.env.CHANNEL_ID).catch(console.error);
    if (!channel) {
        console.error('[Cron Error] Channel not found for weather cron.');
        return;
    }

    // Fetch the guild member object for the bot
    const guild = channel.guild;
    const selfMember = await guild.members.fetch(client.user.id).catch(console.error);

    // Tạo một đối tượng message giả để truyền vào hàm execute của command
    // Lệnh checkWeather của bạn hỗ trợ cả slash và prefix, ta sẽ giả lập prefix command
    const mockMessage = {
        content: `${prefix}checkWeather hanoi`,
        author: client.user,
        channel,
        guild: channel.guild,
        member: selfMember, // Thêm member object vào mock message
        reply: (options) => channel.send(options), // Lệnh checkWeather dùng reply, nên ta trỏ nó tới channel.send
    };

    try {
        await command.execute(mockMessage);
    } catch (error) {
        console.error(`[Cron Error] Error executing '${commandName}':`, error);
        channel.send(`Đã có lỗi xảy ra khi chạy cron job cho lệnh \`${commandName}\`.`);
    }
}

async function runCheckinGICron() {
  const commandName = "checkingi";
  const command = client.commands.get(commandName);

  if (!command) {
    console.error(`[Cron Error] Command '${commandName}' not found.`);
    return;
  }

  console.log(
    `[${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}] Cron: Running '${commandName}'.`
  );

  const channel = await client.channels
    .fetch(process.env.CHECKIN_GI_CHANNEL_ID)
    .catch(console.error);

  if (!channel) {
    console.error("[Cron Error] Channel not found for checkinGI cron.");
    return;
  }

  const guild = channel.guild;
  const selfMember = await guild.members
    .fetch(client.user.id)
    .catch(console.error);

  // mock message giống prefix command
  const mockMessage = {
    content: `${prefix}checkingi`,
    author: client.user,
    channel,
    guild,
    member: selfMember,
    reply: (options) => channel.send(options),
  };

  try {
    await command.execute(mockMessage);
  } catch (error) {
    console.error(`[Cron Error] Error executing '${commandName}':`, error);
    channel.send(`❌ Lỗi khi chạy cron cho \`${commandName}\``);
  }
}

// =====================
// Login bot
// =====================
client.login(process.env.BOT_TOKEN);
