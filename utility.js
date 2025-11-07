require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const telegramBot = require("node-telegram-bot-api");
const DATA_FILE = "tvl_data.json";

const bot = new telegramBot(process.env.TELEGRAM_TOKEN);

async function fetchTVL() {
  const res = await axios.get("https://api.llama.fi/protocols");
  return res.data;
}

function loadYesterday() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log("No tvl_data.json found → starting fresh");
    return {};
  }

  try {
    const fileContent = fs.readFileSync(DATA_FILE, "utf-8").trim();

    // If file is empty or only whitespace
    if (!fileContent) {
      console.log("tvl_data.json is empty → returning {}");
      return {};
    }

    const parsed = JSON.parse(fileContent);
    console.log(
      `Loaded ${Object.keys(parsed).length} protocols from yesterday`
    );
    return parsed;
  } catch (error) {
    console.error("Corrupted tvl_data.json → resetting");
    // Backup corrupted file (optional)
    if (fs.existsSync(DATA_FILE)) {
      fs.renameSync(DATA_FILE, DATA_FILE + ".corrupted");
    }
    return {};
  }
}

function saveToday(data) {
  const map = {};
  data.forEach((p) => {
    if (p.tvl > 1_000_000) {
      // filter tiny protocols
      map[p.name] = p.tvl;
    }
  });

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(map, null, 2)); // pretty print
    console.log(`Saved ${Object.keys(map).length} protocols to tvl_data.json`);
  } catch (err) {
    console.error("Failed to save tvl_data.json:", err);
  }

  return map;
}

const findSpikes = (todayData, yesterdayMap) => {
  const spikes = [];

  todayData.forEach((p) => {
    const name = p.name;
    const tvl = p.tvl;
    const oldTvl = yesterdayMap[name] || 0;

    if (oldTvl && tvl > oldTvl) {
      const change = ((tvl - old) / old) * 100;
      if (change >= 10) {
        spikes.push({
          name,
          change: change.toFixed(1),
          tvl: (tvl / 1e9).toFixed(2),
          chain: protocol.chain,
          url:
            protocol.url ||
            `https://defillama.com/protocol/${name
              .toLowerCase()
              .replace(/\s+/g, "-")}`,
        });
      }
    }
  });
  return spikes;
};

const sendAlert = (spikes) => {
    if (spikes.length === 0) {
      console.log("No spikes today.");
      return;
    }

    let msg = `🚀 TVL Spikes Detected (${new Date().toLocaleDateString()}):\n\n`;
    spikes.forEach((s) => {
      msg += `🔺 <b>${s.name}</b>\n`;
      msg += `Change: <b>${s.change}%</b>\n`;
      msg += `New TVL: <b>$${s.tvl}B</b>\n`;
      msg += `⛓️‍💥 Chain: <b>${s.chain}</b>\n`;
      msg += `🔗 URL: ${s.url}\n\n`;
    });
    bot.sendMessage(CHAT_ID, msg, { parse_mode: "Markdown" });
} 

module.exports = { fetchTVL, loadYesterday, saveToday, findSpikes, sendAlert };
