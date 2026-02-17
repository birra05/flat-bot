import 'dotenv/config';
import { bot } from './bot.js';
import { Storage } from './storage.js';
import { scrapeCityExpert } from './scrapers/cityexpert.js';
import { scrapeHaloOglasi } from './scrapers/halooglasi.js';
import type { Apartment } from './types.js';

const CHECK_INTERVAL = process.env.CHECK_INTERVAL ? parseInt(process.env.CHECK_INTERVAL) : 3 * 60 * 60 * 1000; // 3 hours default
const CHAT_ID = process.env.CHAT_ID;

if (!CHAT_ID) {
  console.warn('WARNING: CHAT_ID not defined in .env. Autopilot notifications will not work.');
}

const storage = new Storage();

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
        if (CHAT_ID) {
          await bot.telegram.sendMessage(
            CHAT_ID, 
            `🆕 <b>New Flat (${apt.source})</b>\n\n` +
            `${apt.title}\n` +
            `💰 ${apt.price} ${apt.currency}\n` +
            `📍 ${apt.location}\n` +
            `${apt.url}`,
            { parse_mode: 'HTML' }
          );
        }
        
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
    if (CHAT_ID && error.response) {
        const status = error.response.status;
        if (status === 403 || status === 429) {
             const url = error.config?.url || 'unknown source';
             // Extract source name from URL
             const source = url.includes('cityexpert') ? 'CityExpert' : (url.includes('halooglasi') ? 'HaloOglasi' : 'Unknown');
             
             await bot.telegram.sendMessage(
                 CHAT_ID,
                 `⚠️ <b>Внимание! Блокировка (${source})</b>\n\n` +
                 `Получен статус ${status}. Рекомендуется увеличить интервал проверки.`,
                 { parse_mode: 'HTML' }
             );
        }
    }
  }
}

// Start bot
bot.launch(() => {
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
