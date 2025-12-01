// Load Supabase Edge Function typings
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Import utilities (ESM)
import {
  fetchTVL,
  loadYesterday,
  findSpikes,
  sendAlert,
  saveToday,
} from "./utility.ts";

// Edge Functions MUST use Deno.serve()
Deno.serve(async (req, info) => {
  // Run heavy job in background
  EdgeRuntime.waitUntil((async () => {
    console.log("Running TVL check...");

    const today = await fetchTVL();
    const yesterday = await loadYesterday();
    const spikes = findSpikes(today, yesterday);

    await sendAlert(spikes);
    await saveToday(today);

    console.log("Background job finished.");
  })());

  // Reply immediately for cron (must return < 5 seconds)
  return new Response("OK", { status: 200 });
});


