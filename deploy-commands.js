const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
// Lấy tất cả các thư mục lệnh từ thư mục commands
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// Lấy tất cả các file lệnh từ thư mục lệnh
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	// Lấy dữ liệu SlashCommandBuilder#toJSON của mỗi lệnh để deploy
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Khởi tạo một instance của module REST
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// và deploy các lệnh của bạn!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// Phương thức put được sử dụng để làm mới hoàn toàn tất cả các lệnh trong guild với bộ lệnh hiện tại
		const data = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// Và đảm bảo bạn bắt và ghi lại bất kỳ lỗi nào!
		console.error(error);
	}
})();