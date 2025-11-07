# TVL Spike Notifier Bot 🚨

Daily alerts when DeFi protocols grow **>10% TVL in 24h**.

### Features
- Uses DeFiLlama API
- Telegram alerts
- Runs daily at 9 AM UTC
- Zero setup (just add .env)

### Setup
```bash
cp .env.example .env
# Add TELEGRAM_TOKEN and TELEGRAM_CHAT_ID
node index.js