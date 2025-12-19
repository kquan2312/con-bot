const { SlashCommandBuilder } = require("discord.js");
const axios = require("axios");
require("dotenv").config();

const ACT_ID = "e202102251931481";
const SIGN_URL =
  "https://sg-hk4e-api.hoyolab.com/event/sol/sign?lang=en-us";
const INFO_URL =
  `https://sg-hk4e-api.hoyolab.com/event/sol/info?lang=en-us&act_id=${ACT_ID}`;

const headers = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://act.hoyolab.com",
  "Referer": "https://act.hoyolab.com/",
  "Cookie": process.env.GI_COOKIE,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("checkingi")
    .setDescription("Daily check-in Genshin Impact"),

  name: "checkingi",
  description: "Daily check-in Genshin Impact",

  async execute(interaction, args) {
    const isInteraction = typeof interaction.deferReply === "function";

    try {
      if (isInteraction) {
        await interaction.deferReply();
      } else {
        await interaction.channel.sendTyping();
      }

      // 1️⃣ CHECK-IN
      const signRes = await axios.post(
        SIGN_URL,
        { act_id: ACT_ID },
        { headers, timeout: 10000 }
      );

      const { retcode, message } = signRes.data;

      if (retcode !== 0 && retcode !== -5003) {
        const errMsg = `❌ Check-in lỗi\nCode: ${retcode}\nMsg: ${message}`;
        return isInteraction
          ? interaction.editReply(errMsg)
          : interaction.reply(errMsg);
      }

      // 2️⃣ LẤY QUÀ
      const infoRes = await axios.get(INFO_URL, {
        headers,
        timeout: 10000,
      });

      const data = infoRes.data?.data;

      if (!data) {
        const msg = "⚠️ Check-in OK nhưng không lấy được thông tin quà.";
        return isInteraction
          ? interaction.editReply(msg)
          : interaction.reply(msg);
      }

      const awards =
        data.awards?.length > 0
          ? data.awards.map(a => `- ${a.name} x${a.cnt}`).join("\n")
          : "- Không có dữ liệu quà";

      const reply =
        `✅ **Genshin Daily Check-in**\n` +
        `📅 Ngày: ${data.today}\n` +
        `🎁 Nhận được:\n${awards}\n` +
        `🔥 Tổng đã điểm danh: ${data.total_sign_day} ngày`;

      return isInteraction
        ? interaction.editReply(reply)
        : interaction.reply(reply);

    } catch (err) {
      console.error(err?.response?.data || err.message);
      const msg = "💥 Lỗi gọi HoYoLAB API, thử lại sau nha.";
      return isInteraction
        ? interaction.editReply(msg)
        : interaction.reply(msg);
    }
  },
};
