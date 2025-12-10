const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const WEATHER_API_TOKEN =
  process.env.WEATHER_API_TOKEN || "db49057747b00b5a079f1e90e35bc2c924541";

// =======================
// Province Mapping
// =======================
const provinceAlias = {
  "nghe an": "Vinh",
  "nghệ an": "Vinh",
  "nghe-an": "Vinh",
  "nghệ-an": "Vinh",
  "ha noi": "Hanoi",
  "hà nội": "Hanoi",
  hn: "Hanoi",
  "dak lak": "Buon Ma Thuot",
  "đắk lắk": "Buon Ma Thuot",
  "đăk lăk": "Buon Ma Thuot",
  "dak-lak": "Buon Ma Thuot",
  "thua thien hue": "Hue",
  "thừa thiên huế": "Hue",
  "binh dinh": "Quy Nhon",
  "bình định": "Quy Nhon",
  "khanh hoa": "Nha Trang",
  "khánh hòa": "Nha Trang",
  "ho chi minh": "Ho Chi Minh City",
  "hồ chí minh": "Ho Chi Minh City",
  hcm: "Ho Chi Minh City",
};

// =======================
// AQI COLOR + DESCRIPTION
// =======================
function getAqiInfo(aqi) {
  const numericAqi = parseInt(aqi, 10);
  if (isNaN(numericAqi))
    return { color: 0x999999, description: "Không có dữ liệu" };
  if (numericAqi <= 50) return { color: 0x00e400, description: "Tốt" };
  if (numericAqi <= 100) return { color: 0xffff00, description: "Trung bình" };
  if (numericAqi <= 150)
    return {
      color: 0xff7e00,
      description: "Không lành mạnh cho nhóm nhạy cảm",
    };
  if (numericAqi <= 200)
    return { color: 0xff0000, description: "Không lành mạnh" };
  if (numericAqi <= 300)
    return { color: 0x8f3f97, description: "Rất không lành mạnh" };
  return { color: 0x7e0023, description: "Nguy hiểm" };
}

// =======================
// Weathercode tiếng Việt
// =======================
const weatherTextMap = {
  0: "Trời quang",
  1: "Ít mây",
  2: "Có mây",
  3: "Âm u",
  45: "Sương mù",
  48: "Sương mù đọng",
  51: "Mưa phùn nhẹ",
  53: "Mưa phùn vừa",
  55: "Mưa phùn nặng",
  56: "Mưa phùn đông đá nhẹ",
  57: "Mưa phùn đông đá nặng",
  61: "Mưa nhỏ",
  63: "Mưa vừa",
  65: "Mưa to",
  66: "Mưa đông đá nhẹ",
  67: "Mưa đông đá nặng",
  71: "Tuyết rơi nhẹ",
  73: "Tuyết rơi vừa",
  75: "Tuyết rơi nặng",
  77: "Băng tuyết rơi",
  80: "Mưa rào nhẹ",
  81: "Mưa rào vừa",
  82: "Mưa rào to",
  85: "Mưa/tuyết rào nhẹ",
  86: "Mưa/tuyết rào to",
  95: "Dông bão",
  96: "Dông bão kèm mưa đá nhẹ",
  99: "Dông bão kèm mưa đá nặng",
};

// =======================
// MAIN
// =======================
module.exports = {
  data: new SlashCommandBuilder()
    .setName("checkweather")
    .setDescription("Kiểm tra thời tiết theo địa điểm.")
    .addStringOption((option) =>
      option
        .setName("location")
        .setDescription("Nhập tên địa điểm (vd: Hanoi, Nghe An)")
        .setRequired(true)
    ),

  async execute(interactionOrMessage) {
    const isInteraction = interactionOrMessage.isChatInputCommand?.();
    let location;

    if (isInteraction) {
      location = interactionOrMessage.options.getString("location");
    } else {
      const args = interactionOrMessage.content.trim().split(/\s+/);
      location = args.slice(1).join(" ");
    }

    if (!location)
      return interactionOrMessage.reply(
        "Nhập location: ví dụ `!checkweather Hanoi`"
      );

    const sent = await interactionOrMessage.reply({
      content: `🔍 Đang tìm vị trí **${location}**...`,
      fetchReply: true,
    });

    try {
      const startTime = Date.now();
      const originalInput = location;

      const normalized = location.trim().toLowerCase();
      if (provinceAlias[normalized]) location = provinceAlias[normalized];

      // ============================
      // 1) GEOCODING LẤY TỌA ĐỘ
      // ============================
      const geoRes = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          location
        )}`
      );

      if (!geoRes.data.results || geoRes.data.results.length === 0)
        return sent.edit(`❌ Không tìm thấy địa điểm: **${originalInput}**`);

      const place = geoRes.data.results[0];
      console.log(`Vị trí người dùng nhập: ${originalInput}`);
      console.log(
        "📍 Vị trí được chọn:",
        JSON.stringify(place, null, 2)
      );
      const lat = place.latitude;
      const lon = place.longitude;
      const countryCode = place.country_code;

      // ============================
      // 2) **AQI MỚI – SEARCH THEO TÊN TỈNH**
      // ============================
      let aqiBlock = null;
      let aqiError = false;
      let aqiNote = null;

      try {
        const searchRes = await axios.get(
          `https://api.waqi.info/search/?keyword=${encodeURIComponent(
            location
          )}&token=${WEATHER_API_TOKEN}`
        );
        
        // Lọc kết quả để chỉ lấy các trạm ở đúng quốc gia
        const station = searchRes.data.data.find(
          (s) => s.station?.country?.substring(0, 2) === countryCode
        );

        if (!station) {
          aqiError = true;
        } else if (!searchRes.data.data || searchRes.data.data.length === 0) {
          aqiError = true;
        } else {
          const uid = station.uid;

          const feedRes = await axios.get(
            `https://api.waqi.info/feed/@${uid}/?token=${WEATHER_API_TOKEN}`
          );

          if (feedRes.data.status === "ok") {
            const data = feedRes.data.data;
            // Nếu aqi là "-", thử ước tính từ các chỉ số khác
            if (data.aqi === "-") {
              let maxPollutant = { value: -1, name: "" };
              // Chỉ xem xét các chất gây ô nhiễm thực tế, bỏ qua các chỉ số thời tiết như P (áp suất), T (nhiệt độ), H (độ ẩm)...
              const validPollutants = ["pm25", "pm10", "o3", "no2", "so2", "co"];

              if (data.iaqi) {
                for (const pollutant in data.iaqi) {
                  if (
                    validPollutants.includes(pollutant) &&
                    data.iaqi[pollutant].v > maxPollutant.value
                  ) {
                    maxPollutant.value = data.iaqi[pollutant].v;
                    maxPollutant.name = pollutant.toUpperCase();
                  }
                }
              }

              if (maxPollutant.value > -1) {
                data.aqi = maxPollutant.value;
                aqiNote = `(Ước tính từ ${maxPollutant.name})`;
              } else {
                aqiError = true; // Không có dữ liệu nào để ước tính
              }
            }
            if (!aqiError) aqiBlock = data;
          } else aqiError = true;
        }
      } catch (err) {
        console.error("AQI ERROR:", err);
        aqiError = true;
      }

      // ============================
      // 3) WEATHER
      // ============================
      const weatherRes = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&hourly=weathercode,cloudcover,precipitation,temperature_2m,relativehumidity_2m,windspeed_10m&forecast_hours=1` +
          `&daily=weathercode,precipitation_sum,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`
      );

      const daily = weatherRes.data.daily;
      let next7Days = "";

      for (let i = 0; i < daily.time.length; i++) {
        const date = daily.time[i].split("-").reverse().join("/");
        const txt = weatherTextMap[daily.weathercode[i]] || "Không rõ";
        next7Days += `• **${date}** – ${txt} – ${daily.temperature_2m_max[i]}°C / ${daily.temperature_2m_min[i]}°C – ${daily.precipitation_sum[i]}mm\n`;
      }

      const hourly = weatherRes.data.hourly;

      const weatherCode = hourly.weathercode?.[0];
      const weatherText = weatherTextMap[weatherCode] || "Không rõ";

      const endTime = Date.now();
      const apiCallTime = endTime - startTime;

      // ============================
      // EMBED
      // ============================
      const embed = new EmbedBuilder().setTitle(
        `🌍 Khu vực: ${originalInput}`
      );

      if (!aqiError) embed.setColor(getAqiInfo(aqiBlock.aqi).color);
      else embed.setColor(0x999999);

      embed.addFields([
        {
          name: "🌫 AQI",
          value: aqiError
            ? "Không có dữ liệu."
            : `**${aqiBlock.aqi}** – ${
                getAqiInfo(aqiBlock.aqi).description
              } ${aqiNote ? `\n*${aqiNote}*` : ""}`,
        },
        {
          name: "📍 Trạm AQI",
          value: aqiError
            ? "Khu vực này không có trạm đo AQI."
            : aqiBlock.city.name,
        },
        {
          name: "🕒 Cập nhật",
          value:
            aqiError || !aqiBlock.time?.s
              ? "N/A"
              : aqiBlock.time.s.replace(" ", " • "),
        },
        { name: "🌦 Thời tiết", value: weatherText },
        {
          name: "🌡 Nhiệt độ",
          value: `${hourly.temperature_2m[0]}°C`,
          inline: true,
        },
        {
          name: "💧 Độ ẩm",
          value: `${hourly.relativehumidity_2m[0]}%`,
          inline: true,
        },
        {
          name: "💨 Gió",
          value: `${hourly.windspeed_10m[0]} km/h`,
          inline: true,
        },
        {
          name: "📅 7 ngày tới",
          value: next7Days,
        },
      ]);

      embed.setFooter({
        text: `Lat: ${lat}, Lon: ${lon} • API: ${apiCallTime}ms`,
      });

      await sent.edit({ content: "", embeds: [embed] });

    } catch (e) {
      console.error(e);
      sent.edit("⚠️ Lỗi khi xử lý request.");
    }
  },
};
