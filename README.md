# Flat Bot 🤖 🇷🇸

A Telegram bot that helps you find rental apartments in Belgrade, Serbia. It automatically scrapes **CityExpert** and **Halo Oglasi**, filters out duplicates, and sends instant notifications to your Telegram chat.

## Features

- **Multi-Source Scraping**: Monitors both [CityExpert](https://cityexpert.rs) and [Halo Oglasi](https://www.halooglasi.com) in parallel.
- **Smart Deduplication**: Avoids duplicate notifications by tracking unique apartments based on `Price + Size + Location + Floor + Rooms`, even if they appear on multiple sites with different IDs.
- **Anti-Ban System**: Uses stealth headers, "jittered" scheduling (random delays), and human-like request patterns to avoid blocking.
- **Alert System**: Instantly notifies you if a scraper gets blocked (403/429 errors).
- **Modern Tech**: Built with Node.js v22, TypeScript, and `tsx`.

## Prerequisites

- Node.js v22+
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- A Telegram Chat ID (to send messages to)

## Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/flat-bot.git
    cd flat-bot
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure environment**:
    Create a `.env` file in the root directory:
    ```bash
    BOT_TOKEN=your_telegram_bot_token
    CHAT_ID=your_telegram_chat_id
    CHECK_INTERVAL=10800000 # Time in ms (e.g., 3 hours = 10800000)
    ```

## Usage

Start the bot:

```bash
npm start
```

## Docker

1. Build image:
   ```bash
   docker build -t flat-bot .
   ```

2. Run container:
   ```bash
   docker run -d \
     --name flat-bot \
     --restart unless-stopped \
     --env-file .env \
     -v "$(pwd)/data:/app/data" \
     flat-bot
   ```

Or run with Compose (recommended):

```bash
docker compose up -d --build
```

The bot will:
1.  Perform an initial scrape immediately.
2.  Send notifications for any *new* apartments found.
3.  Schedule the next check based on your `CHECK_INTERVAL` (+ random jitter).

## Development

Run in watch mode:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Structure

- `src/scrapers/`: Individual logic for CityExpert, HaloOglasi, etc.
- `src/storage.ts`: JSON-based "database" for tracking seen apartments.
- `src/index.ts`: Main autopilot loop.
- `src/bot.ts`: Telegraf bot instance and commands.

## License

MIT
