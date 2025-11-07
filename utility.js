require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const telegramBot = require("node-telegram-bot-api");
const DATA_FILE = "tvl_data.json";

const bot = new telegramBot(process.env.TELEGRAM_TOKEN);
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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
      const change = ((tvl - oldTvl) / oldTvl) * 100;
      if (change >= 10) {
        spikes.push({
          name,
          change: change.toFixed(1),
          tvl: (tvl / 1e9).toFixed(2),
          chain: p.chain,
          url:
            p.url ||
            `https://defillama.com/protocol/${name
              .toLowerCase()
              .replace(/\s+/g, "-")}`,
        });
      }
    }
  });
  return spikes;
};

async function sendAlert(spikes) {
 
  let msg = `TVL BOT IS NOW LIVE IN GROUP\n\n`;

  if (spikes.length === 0) {
    msg += `No spikes today — but bot is alive!\n`;
    msg += `Next check: tomorrow 9 AM UTC\n`;
    msg += `Built by @hammed_t`;
  } else {
    msg += `<b>TVL SPIKES DETECTED</b> (${new Date().toLocaleDateString()})\n\n`;
    spikes.forEach((s) => {
      msg += `<b>${s.name}</b> (+${s.change}%) → <b>$${s.tvl}B</b> [${s.chain}]\n`;
      msg += `${s.url}\n\n`;
    });
    msg += `Powered by @hammed_t | https://github.com/hammedt20/tvl-notifier`;
  }

  try {
    await bot.sendMessage(CHAT_ID, msg, { parse_mode: "HTML" });
    console.log("ALERT SENT TO GROUP!");
  } catch (error) {
    console.error("TELEGRAM ERROR:", error.message);
    
  }
}

module.exports = { fetchTVL, loadYesterday, saveToday, findSpikes, sendAlert };
