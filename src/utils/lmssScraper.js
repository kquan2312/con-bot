import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Fetch LMSS+ rank info from lmssplus.org
 * @param {string} summonerName
 */
export async function getRankInfo(summonerName) {
    try {
        const url = `https://lmssplus.org/profile/vn/${encodeURIComponent(summonerName)}/`;
        const res = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" },
        });

        const $ = cheerio.load(res.data);

        // LMSS+ VN hiện tại có 2 box: Solo/Duo và Flex
        const queues = [];

        $("div.profile-rank-card").each((i, el) => {
            const queueType = $(el).find(".queue-type").text().trim() || (i === 0 ? "Solo/Duo" : "Flex");
            const tier = $(el).find(".tier").text().trim() || "UNKNOWN";
            const rank = $(el).find(".rank").text().trim() || "";
            const lp = $(el).find(".lp").text().trim() || "UNKNOWN";
            const wrText = $(el).find(".winrate").text().trim(); // ví dụ "56% Win Rate"
            const winrateMatch = wrText.match(/\d+%/) || ["UNKNOWN"];
            const winrate = winrateMatch[0];

            queues.push({ queueType, tier, rank, lp, winrate });
        });

        if (queues.length === 0) {
            throw new Error("Không có dữ liệu cho summoner này");
        }

        return { success: true, summoner: summonerName, queues };

    } catch (err) {
        console.error("Scraper lỗi:", err.message || err);
        return {
            success: false,
            error: "Không lấy được dữ liệu, LMSS+ VN có thể đổi layout."
        };
    }
}
