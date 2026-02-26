import 'dotenv/config';
import { bot } from './bot.js';
import { Storage } from './storage.js';
import { subscriberStorage } from './subscribers.js';
import { scrapeCityExpert } from './scrapers/cityexpert.js';
import { scrapeHaloOglasi } from './scrapers/halooglasi.js';
import type { Apartment } from './types.js';

const CHECK_INTERVAL = process.env.CHECK_INTERVAL ? parseInt(process.env.CHECK_INTERVAL) : 3 * 60 * 60 * 1000; // 3 hours default

const storage = new Storage();
const BOT_COMMANDS = [
  { command: 'start', description: 'Подписаться на автопоиск' },
  { command: 'search', description: 'Поиск квартир вручную' },
  { command: 'stop', description: 'Отписаться от автопоиска' }
];

async function registerBotCommands() {
  try {
    // Reset command menu explicitly to avoid stale cached scopes.
    await bot.telegram.deleteMyCommands();
    await bot.telegram.deleteMyCommands({ scope: { type: 'all_private_chats' } });

    await bot.telegram.setMyCommands(BOT_COMMANDS);
    await bot.telegram.setMyCommands(BOT_COMMANDS, { scope: { type: 'all_private_chats' } });

    const activeCommands = await bot.telegram.getMyCommands();
    console.log('Registered bot commands:', activeCommands.map((c) => c.command).join(', '));
  } catch (error: any) {
    console.error('Failed to register bot commands:', error.message);
  }
}

async function sendToAllChats(message: string) {
  const subscribers = await subscriberStorage.getAll();
  if (subscribers.length === 0) return;

  await Promise.allSettled(
    subscribers.map((chatId) =>
      bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' })
    )
  );
}

// Autopilot function
async function runAutopilot() {
  console.log('Running autopilot check...');
  try {
    // 1. Load seen IDs
    await storage.load();

    // 2. Scrape all sources in parallel
    // For now, simple fixed params for monitoring (e.g. general search or last 24h)
    const [cityExpertApts, haloApts] = await Promise.all([
        scrapeCityExpert({ city: 'Belgrade' }),
        scrapeHaloOglasi({ city: 'Belgrade' })
    ]);
    
    console.log('[Autopilot] Scrape successful (200 OK)');
    const apartments: Apartment[] = [...cityExpertApts, ...haloApts];
    
    // 3. Filter new items
    const newApartments = apartments.filter(apt => storage.isNew(apt));

    if (newApartments.length > 0) {
      console.log(`Found ${newApartments.length} new apartments!`);
      
      for (const apt of newApartments) {
        // Send notification
        await sendToAllChats(
          `🆕 <b>New Flat (${apt.source})</b>\n\n` +
          `${apt.title}\n` +
          `💰 ${apt.price} ${apt.currency}\n` +
          `📍 ${apt.location}\n` +
          `${apt.url}`
        );
        
        // Mark as seen
        storage.add(apt);
      }
      
      // 4. Save updated storage
      await storage.save();
    } else {
      console.log('No new apartments found.');
    }

  } catch (error: any) {
    console.error('Autopilot error:', error.message);
    
    // Alert on blocking
    if (error.response) {
        const status = error.response.status;
        if (status === 403 || status === 429) {
             const url = error.config?.url || 'unknown source';
             // Extract source name from URL
             const source = url.includes('cityexpert') ? 'CityExpert' : (url.includes('halooglasi') ? 'HaloOglasi' : 'Unknown');
             
             await sendToAllChats(
               `⚠️ <b>Внимание! Блокировка (${source})</b>\n\n` +
               `Получен статус ${status}. Рекомендуется увеличить интервал проверки.`
             );
        }
    }
  }
}

// Start bot
bot.launch(async () => {
    await registerBotCommands();
    console.log('Bot started!');
});

// Schedule next run with jitter
function scheduleNextRun() {
    // Jitter: random delay between 10s and 90s
    const jitter = Math.floor(Math.random() * (90000 - 10000 + 1)) + 10000;
    const delay = CHECK_INTERVAL + jitter;
    
    console.log(`Next check in ${Math.round(delay / 1000)}s`);
    
    setTimeout(() => {
        runAutopilot().then(() => {
            scheduleNextRun();
        });
    }, delay);
}

// Initial run
runAutopilot().then(() => {
    scheduleNextRun();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
