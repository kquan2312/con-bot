const { SlashCommandBuilder } = require('discord.js');
const Groq = require("groq-sdk");
require("dotenv").config();
function splitText(text, max = 2000) {
  const chunks = [];
  let current = '';

  for (const line of text.split('\n')) {
    if ((current + line).length > max) {
      chunks.push(current);
      current = '';
    }
    current += line + '\n';
  }

  if (current) chunks.push(current);
  return chunks;
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sessions = {};

module.exports = {
  sessions,

  data: new SlashCommandBuilder()
    .setName('gpt')
    .setDescription('Hỏi AI câu gì đó')
    .addStringOption(opt =>
      opt.setName('prompt')
        .setDescription('Nội dung bạn muốn hỏi AI')
        .setRequired(true)
    ),

  name: 'gpt',
  description: 'Hỏi AI câu gì đó',

  async execute(interaction, args) {
    const isInteraction = typeof interaction.deferReply === 'function';
    let prompt;
    let userId;

    if (isInteraction) {
      // chạy bằng slash command
      await interaction.deferReply();
      prompt = interaction.options.getString('prompt');
      userId = interaction.user.id;
    } else {
      // chạy bằng !gpt message
      userId = interaction.author.id;
      prompt = args?.join(" ") || interaction.content.split(" ").slice(1).join(" ");

      if (!prompt) return interaction.reply("Nhập nội dung đi bro 😭");
      await interaction.channel.sendTyping();
    }

    // nếu chưa có session user → tạo
    if (!sessions[userId]) sessions[userId] = [];

    // push câu hỏi
    sessions[userId].push({ role: "user", content: prompt });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: sessions[userId],
    });

    const reply = completion.choices?.[0]?.message?.content || "Tao bí rồi :(";

    // push câu trả lời để giữ context
    sessions[userId].push({ role: "assistant", content: reply });

    const parts = splitText(reply);

if (isInteraction) {
  await interaction.editReply(parts.shift());
  for (const part of parts) {
    await interaction.followUp(part);
  }
} else {
  for (const part of parts) {
    await interaction.channel.send(part);
  }
}

  },
  
};
