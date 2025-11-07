const cron = require("node-cron")
const express = require("express")

const app =express();

const { fetchTVL, loadYesterday, findSpikes, sendAlert, saveToday } = require("./utility")


async function runTVLCheck() {
  console.log('🚀 Running TVL check NOW...');
  const todayData = await fetchTVL();
  const yesterdayMap = loadYesterday();

  const spikes = findSpikes(todayData, yesterdayMap);
  await sendAlert(spikes);

  saveToday(todayData);  // update for tomorrow
  console.log('✅ Check complete!');
}

runTVLCheck()

cron.schedule("0 9 * * *", () => {
  console.log("⏰ Daily 9 AM TVL check triggered");
  runTVLCheck();
});

app.get("/health", (req, res) => res.send("TVL Bot Alive 🚀"));
app.listen(process.env.PORT || 3000);