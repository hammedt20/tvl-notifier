// utility.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Telegram ENV Vars
const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_TOKEN")!;
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;

/* ----------------------------------------------------
   FETCH TODAY’S TVL SNAPSHOT (raw from API)
----------------------------------------------------- */
export async function fetchTVL() {
  console.log("fetchTVL: requesting https://api.llama.fi/protocols");
  const res = await fetch("https://api.llama.fi/protocols");
  if (!res.ok) {
    const body = await res.text();
    console.error("fetchTVL: API error", res.status, body);
    throw new Error("Failed to fetch TVL");
  }
  const json = await res.json();
  console.log("fetchTVL: got", Array.isArray(json) ? json.length : "unknown", "items");
  return json;
}

export async function loadYesterday() {
  console.log("loadYesterday: loading id='yesterday' from tvl_data");
  const { data, error } = await supabase
    .from("tvl_data")
    .select("data")
    .eq("id", "yesterday")
    .single();

  if (error) {
    // If table missing or row not present, return empty object
    console.warn("loadYesterday: supabase returned error", error.message || error);
    return {};
  }

  console.log("loadYesterday: loaded snapshot keys:", data?.data ? Object.keys(data.data).length : 0);
  return data?.data ?? {};
}

export async function saveToday(protocols: any[]) {
  console.log("saveToday: building snapshot map");
  const snapshot: Record<string, number> = {};

  protocols.forEach((p) => {
    // keep only protocols with meaningful tvl
    if (typeof p.tvl === "number" && p.tvl > 1_000_000) {
      snapshot[p.name] = p.tvl;
    }
  });

  console.log("saveToday: upserting snapshot with", Object.keys(snapshot).length, "entries");

  const { error } = await supabase.from("tvl_data").upsert({
    id: "yesterday",
    data: snapshot,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("saveToday: upsert error", error);
    throw new Error("Failed to save snapshot");
  }

  return snapshot;
}

export function findSpikes(todayProtocols: any[], yesterdayMap: Record<string, number>) {
  const spikes: Array<{ name: string; change: string; tvl: string; chain?: string; url?: string }> = [];

  if (!Array.isArray(todayProtocols)) {
    console.warn("findSpikes: todayProtocols is not an array");
    return spikes;
  }

  todayProtocols.forEach((p) => {
    const name = p.name;
    const tvl = Number(p.tvl || 0);
    const old = Number(yesterdayMap?.[name] || 0);

    if (!old) return; // need yesterday to compare
    if (old === 0) return;

    const change = ((tvl - old) / old) * 100;
    if (change >= 10) {
      spikes.push({
        name,
        change: change.toFixed(1),
        tvl: (tvl / 1e9).toFixed(2),
        chain: p.chain,
        url: p.url || `https://defillama.com/protocol/${name.toLowerCase().replace(/\s+/g, "-")}`,
      });
    }
  });

  console.log("findSpikes: found", spikes.length, "spikes");
  return spikes;
}

async function telegramSend(text: string) {
  const MAX = 3500; // safe limit under Telegram's 4096 cap

  // Split into chunks
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += MAX) {
    chunks.push(text.slice(i, i + MAX));
  }

  console.log("telegramSend: message split into", chunks.length, "chunks");

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  let lastResponse = "";

  for (const part of chunks) {
    const body = {
      chat_id: CHAT_ID,
      text: part, // IMPORTANT — send chunk, not full text
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };

    console.log("telegramSend: sending chunk length", part.length);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const textResp = await res.text();
    lastResponse = textResp;

    if (!res.ok) {
      console.error("telegramSend: chunk error", res.status, textResp);
      throw new Error("Telegram send failed");
    }
  }

  console.log("telegramSend: all chunks sent");
  return lastResponse;
}
W

export async function sendAlert(spikes: any[]) {
  let msg = `TVL BOT IS NOW LIVE\n\n`;

  if (!Array.isArray(spikes) || spikes.length === 0) {
    msg += `No spikes today.\nNext check: tomorrow 9 AM UTC\n`;
    // telegramSend("sendAlert: no spikes, not sending detailed alert");
    // still send a heartbeat if you want — comment out to disable
    await telegramSend(msg);
    return;
  }

  msg += `<b>TVL SPIKES DETECTED</b>\n\n`;
  spikes.forEach((s) => {
    msg += `<b>${s.name}</b> (+${s.change}%) → <b>$${s.tvl}B</b> [${s.chain || "unknown"}]\n`;
    msg += `${s.url}\n\n`;
  });

  // send and return response body
  const resp = await telegramSend(msg);
  return resp;
}
