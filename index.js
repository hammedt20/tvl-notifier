const express = require("express");

const app = express();

const {
  fetchTVL,
  loadYesterday,
  findSpikes,
  sendAlert,
  saveToday,
} = require("./utility");

async function runTVLCheck() {
  console.log("🚀 Running TVL check NOW...");
  const todayData = await fetchTVL();
  const yesterdayMap = loadYesterday();

  const spikes = findSpikes(todayData, yesterdayMap);
  await sendAlert(spikes);

  saveToday(todayData); // update for tomorrow
  console.log("✅ Check complete!");
}
app.get("/health", (req, res) => res.status(200).send("OK"));

app.get("/run-tvl-check", (req, res) => {
  const key = req.query.key;

  if (process.env.CRON_SECRET && key !== process.env.CRON_SECRET) {
    return res.status(401).send("Unauthorized");
  }

  res.status(200).send("OK");

  runTVLCheck()
    .then(() => console.log("✅ TVL check complete"))
    .catch((err) => console.error("Error running TVL check:", err));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
