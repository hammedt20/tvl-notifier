
import axios from "npm:axios";
import TelegramBot from "npm:node-telegram-bot-api";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") // REQUIRED for writes
);

const bot = new TelegramBot(Deno.env.get("TELEGRAM_TOKEN"));
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

async function fetchTVL() {
  const res = await axios.get("https://api.llama.fi/protocols");
  return res.data;
}

async function loadYesterday() {
  const { data, error } = await supabase
    .from("tvl_data")
    .select("data")
    .eq("id", "yesterday")
    .single();

  if (error || !data) return {};
  return data.data;
}

async function saveToday(protocols) {
  const map = {};
  protocols.forEach((p) => {
    if (p.tvl > 1_000_000) map[p.name] = p.tvl;
  });

  await supabase.from("tvl_data").upsert({ id: "yesterday", data: map });

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

async function sendInChunks(bot, chatId, text, chunkSize = 4000) {
  // Telegram messages have a 4096 character limit, 4000 is safer especially with HTML formatting
  const chunks = [];

  while (text.length > 0) {
    if (text.length <= chunkSize) {
      chunks.push(text);
      break;
    }

    // Try to split at the nearest \n\n or \n to avoid breaking HTML tags or lines awkwardly
    let idx = text.lastIndexOf("\n\n", chunkSize);
    if (idx === -1) idx = text.lastIndexOf("\n", chunkSize);
    if (idx === -1) idx = chunkSize; // fallback if no line break

    chunks.push(text.substring(0, idx));
    text = text.substring(idx).trim();
  }

  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
  }
}

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
    await sendInChunks(bot, CHAT_ID, msg);
    console.log("ALERT SENT TO GROUP!");
  } catch (error) {
    console.error("TELEGRAM ERROR:", error.message);
    console.error("Your CHAT_ID:", CHAT_ID);
  }
}

module.exports = { fetchTVL, loadYesterday, saveToday, findSpikes, sendAlert };
