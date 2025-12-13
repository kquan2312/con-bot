const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const WEATHER_API_TOKEN =
  process.env.WEATHER_API_TOKEN || "YOUR_WAQI_TOKEN";

const MAX_AQI_AGE_HOURS = 6; // AQI quá 6h coi như hết hạn
const MAX_DISTANCE_KM = 60; // bán kính lấy trạm AQI

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
// Utils
// =======================
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getAqiInfo(aqi) {
  const v = parseInt(aqi, 10);
  if (isNaN(v)) return { color: 0x999999, description: "Không có dữ liệu" };
  if (v <= 50) return { color: 0x00e400, description: "Tốt" };
  if (v <= 100) return { color: 0xffff00, description: "Trung bình" };
  if (v <= 150)
    return { color: 0xff7e00, description: "Không lành mạnh cho nhóm nhạy cảm" };
  if (v <= 200) return { color: 0xff0000, description: "Không lành mạnh" };
  if (v <= 300) return { color: 0x8f3f97, description: "Rất không lành mạnh" };
  return { color: 0x7e0023, description: "Nguy hiểm" };
}

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
  61: "Mưa nhỏ",
  63: "Mưa vừa",
  65: "Mưa to",
  80: "Mưa rào nhẹ",
  81: "Mưa rào vừa",
  82: "Mưa rào to",
};

// =======================
// MAIN
// =======================
module.exports = {
  data: new SlashCommandBuilder()
    .setName("checkweather")
    .setDescription("Kiểm tra thời tiết + AQI theo vị trí thực")
    .addStringOption((option) =>
      option
        .setName("location")
        .setDescription("Ví dụ: Hanoi, Nghệ An")
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

    const sent = await interactionOrMessage.reply({
      content: `🔍 Đang tìm **${location}**...`,
      fetchReply: true,
    });

    try {
      const startTime = Date.now();
      const originalInput = location;

      const normalized = location.trim().toLowerCase();
      if (provinceAlias[normalized]) location = provinceAlias[normalized];

      // ============================
      // 1) GEOCODING
      // ============================
      const geoRes = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          location
        )}`
      );

      if (!geoRes.data.results?.length)
        return sent.edit(`❌ Không tìm thấy địa điểm **${originalInput}**`);

      const place = geoRes.data.results[0];
      const lat = place.latitude;
      const lon = place.longitude;

      // ============================
      // 2) AQI – LẤY THEO TỌA ĐỘ (CHUẨN)
      // ============================
      let aqiBlock = null;
      let aqiError = false;

      try {
        const mapRes = await axios.get(
          `https://api.waqi.info/map/bounds/?latlng=${lat - 0.5},${lon - 0.5},${
            lat + 0.5
          },${lon + 0.5}&token=${WEATHER_API_TOKEN}`
        );

        const stations = (mapRes.data.data || [])
          .filter((s) => s.lat && s.lon)
          .map((s) => ({
            uid: s.uid,
            lat: s.lat,
            lon: s.lon,
            distance: getDistanceKm(lat, lon, s.lat, s.lon),
          }))
          .filter((s) => s.distance <= MAX_DISTANCE_KM)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5);

        const feeds = await Promise.all(
          stations.map(async (s) => {
            try {
              const res = await axios.get(
                `https://api.waqi.info/feed/@${s.uid}/?token=${WEATHER_API_TOKEN}`
              );

              const data = res.data.data;
              if (!data?.time?.s || data.aqi === "-") return null;

              const timeValue = new Date(data.time.s).getTime();
              const ageHours = (Date.now() - timeValue) / 36e5;
              if (ageHours > MAX_AQI_AGE_HOURS) return null;

              return { ...data, _timeValue: timeValue, _ageHours: ageHours };
            } catch {
              return null;
            }
          })
        );

        const validFeeds = feeds.filter(Boolean);
        if (!validFeeds.length) aqiError = true;
        else {
          validFeeds.sort((a, b) => b._timeValue - a._timeValue);
          aqiBlock = validFeeds[0];
        }
      } catch {
        aqiError = true;
      }

      // ============================
      // 3) WEATHER
      // ============================
      const weatherRes = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&hourly=weathercode,temperature_2m,relativehumidity_2m,windspeed_10m&forecast_hours=1` +
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
      const weatherText = weatherTextMap[hourly.weathercode[0]] || "Không rõ";

      // ============================
      // EMBED
      // ============================
      const embed = new EmbedBuilder().setTitle(`🌍 Khu vực: ${originalInput}`);

      embed.setColor(
        aqiError ? 0x999999 : getAqiInfo(aqiBlock.aqi).color
      );

      embed.addFields([
        {
          name: "🌫 AQI",
          value: aqiError
            ? "Không có dữ liệu AQI realtime."
            : `**${aqiBlock.aqi}** – ${getAqiInfo(aqiBlock.aqi).description}`,
        },
        {
          name: "📍 Trạm AQI",
          value: aqiError ? "N/A" : aqiBlock.city.name,
        },
        {
          name: "🕒 Cập nhật",
          value: aqiError
            ? "N/A"
            : aqiBlock.time.s.replace(" ", " • "),
        },
        { name: "🌦 Thời tiết", value: weatherText },
        { name: "🌡 Nhiệt độ", value: `${hourly.temperature_2m[0]}°C`, inline: true },
        { name: "💧 Độ ẩm", value: `${hourly.relativehumidity_2m[0]}%`, inline: true },
        { name: "💨 Gió", value: `${hourly.windspeed_10m[0]} km/h`, inline: true },
        { name: "📅 7 ngày tới", value: next7Days },
      ]);

      embed.setFooter({
        text: `Lat: ${lat}, Lon: ${lon} • API: ${Date.now() - startTime}ms`,
      });

      await sent.edit({ content: "", embeds: [embed] });
    } catch (e) {
      console.error(e);
      sent.edit("⚠️ Lỗi khi xử lý request.");
    }
  },
};
