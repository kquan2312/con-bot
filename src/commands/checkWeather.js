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
// Vietnam bounding box
// =======================
const VN_BOUNDS = { minLat: 8, maxLat: 24, minLon: 102, maxLon: 110 };

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
// Main
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

    if (!location) {
      return interactionOrMessage.reply(
        "Nhập location: ví dụ `!checkweather Hanoi`"
      );
    }

    const sent = await interactionOrMessage.reply({
      content: `🔍 Đang tìm vị trí **${location}**...`,
      fetchReply: true,
    });

    try {
      const startTime = Date.now();
      const originalInput = location;
      const normalized = location.trim().toLowerCase();
      if (provinceAlias[normalized]) location = provinceAlias[normalized];

      // ======================
      // 1) Geocoding API
      // ======================
      const geoRes = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          location
        )}`
      );
      if (!geoRes.data.results || geoRes.data.results.length === 0)
        return sent.edit(`❌ Không tìm thấy địa điểm: **${originalInput}**`);

      const place = geoRes.data.results[0];
      const lat = place.latitude;
      const lon = place.longitude;
      console.log("📍 Vị trí người dùng nhập:", place);

      // ======================
      // 2) AQI API /feed/geo:lat;lon/
      // ======================
      let aqiBlock = null;
      let aqiError = true;
      let usedNearest = false;
      try {
        const aqiRes = await axios.get(
          `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WEATHER_API_TOKEN}`
        );
        if (aqiRes.data.status === "ok") {
          aqiBlock = aqiRes.data.data;
          aqiError = false;
        } else {
          // fallback: tìm trạm gần nhất
          const nearbyRes = await axios.get(
            `https://api.waqi.info/map/bounds/?token=${WEATHER_API_TOKEN}&latlng=${VN_BOUNDS.minLat},${VN_BOUNDS.minLon},${VN_BOUNDS.maxLat},${VN_BOUNDS.maxLon}`
          );
          if (
            nearbyRes.data.status === "ok" &&
            nearbyRes.data.data.length > 0
          ) {
            const distance = (lat1, lon1, lat2, lon2) =>
              Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));

            const validStations = nearbyRes.data.data.filter(
              (s) => s.aqi !== "-"
            );
            if (validStations.length > 0) {
              const nearestStation = validStations.reduce((prev, curr) =>
                distance(lat, lon, curr.lat, curr.lon) <
                distance(lat, lon, prev.lat, prev.lon)
                  ? curr
                  : prev
              );
              const dist = distance(
                lat,
                lon,
                nearestStation.lat,
                nearestStation.lon
              );
              aqiBlock = {
                aqi: nearestStation.aqi,
                city: { name: nearestStation.station.name },
                iaqi: nearestStation.iaqi || {},
                time: { s: nearestStation.station.time }, // Lấy thời gian từ trạm gần nhất
              };
              aqiError = false;
              usedNearest = true;
              aqiBlock.distance = dist;
            }
          }
        }
      } catch (err) {
        console.warn("Không lấy được trạm AQI", err);
      }

      // ======================
      // 3) Weather API
      // ======================
      const weatherRes = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=weathercode,cloudcover,precipitation,temperature_2m,relativehumidity_2m,windspeed_10m&forecast_hours=1`
      );
      const hourly = weatherRes.data.hourly;

      const weatherCode = hourly.weathercode?.[0];
      const cloudCover = hourly.cloudcover?.[0];
      const precipitation = hourly.precipitation?.[0];
      const tempForecast = hourly.temperature_2m?.[0];
      const humidityForecast = hourly.relativehumidity_2m?.[0];
      const windForecast = hourly.windspeed_10m?.[0];

      const weatherText = weatherTextMap[weatherCode] || "Không rõ";

      const endTime = Date.now();
      const apiCallTime = endTime - startTime;

      // ======================
      // BUILD EMBED
      // ======================
      const embed = new EmbedBuilder()
        .setColor(aqiError ? 0x999999 : getAqiInfo(aqiBlock.aqi).color)
        .setTitle(`🌍 Khu vực bạn yêu cầu: ${originalInput}`);

      let aqiTimeFormatted = "N/A";
      if (!aqiError && aqiBlock.time && aqiBlock.time.s) {
        // Định dạng lại thời gian từ "YYYY-MM-DD HH:mm:ss" thành "HH:mm - DD/MM/YYYY"
        const [datePart, timePart] = aqiBlock.time.s.split(" ");
        const [year, month, day] = datePart.split("-");
        const [hour, minute] = timePart.split(":");
        aqiTimeFormatted = `${hour}:${minute} - ${day}/${month}/${year}`;
      }

      embed.addFields(
        {
          name: "🌫 AQI",
          value: aqiError
            ? "❌ Không có trạm AQI tại khu vực này."
            : `${aqiBlock.aqi} – ${getAqiInfo(aqiBlock.aqi).description}`,
        },
        {
          name: "📍 Trạm AQI",
          value: aqiError
            ? "-"
            : `${aqiBlock.city.name}${
                usedNearest
                  ? ` (gần nhất, cách ~${(aqiBlock.distance * 111).toFixed(
                      1
                    )} km)`
                  : ""
              }`,
        }
      );

      embed.addFields(
        { name: "🕒 Cập nhật AQI lúc", value: aqiTimeFormatted },
        { name: "🌦 Thời tiết", value: `${weatherCode} (${weatherText})` },
        { name: "☁ Độ che phủ", value: `${cloudCover}%`, inline: true },
        { name: "🌧 Lượng mưa", value: `${precipitation} mm`, inline: true },
        {
          name: "🌡 Nhiệt độ (Dự báo)",
          value: `${tempForecast}°C`,
          inline: true,
        },
        {
          name: "💧 Độ ẩm (Dự báo)",
          value: `${humidityForecast}%`,
          inline: true,
        },
        {
          name: "💨 Tốc độ gió (Dự báo)",
          value: `${windForecast} km/h`,
          inline: true,
        }
      );

      embed.setFooter({
        text: `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(
          4
        )} • API: ${apiCallTime}ms`,
      });
      await sent.edit({ content: "", embeds: [embed] });
    } catch (err) {
      console.error(err);
      await sent.edit("Có lỗi xảy ra khi lấy thông tin thời tiết.");
    }
  },
};
