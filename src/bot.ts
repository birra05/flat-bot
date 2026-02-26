import { Telegraf } from 'telegraf';
import { scrapeCityExpert } from './scrapers/cityexpert.js';
import { scrapeHaloOglasi } from './scrapers/halooglasi.js';
import type { Apartment } from './types.js';
import { subscriberStorage } from './subscribers.js';

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined');
}

export const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {
  const chatId = String(ctx.chat.id);
  const isNew = await subscriberStorage.add(chatId);

  await ctx.reply(
    'Привет! Я помогу тебе найти квартиру в Сербии.\n\n' +
    `${isNew ? 'Ты подписан(а) на автопоиск новых квартир.\n' : 'Ты уже подписан(а) на автопоиск.\n'}` +
    'Используй команду /search с параметрами:\n' +
    '/search [цена_макс] [кол-во_комнат]\n\n' +
    'Примеры:\n' +
    '/search 500 1.5 (до 500€, мин 1.5 комнаты)\n' +
    '/search 1000 (до 1000€, любые комнаты)\n\n' +
    'Отписка от автопоиска: /stop'
  );
});

bot.command('stop', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const removed = await subscriberStorage.remove(chatId);
  await ctx.reply(removed ? 'Готово. Ты отписан(а) от автопоиска.' : 'Ты не был(а) подписан(а) на автопоиск.');
});

bot.command('search', async (ctx) => {
  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const priceMax = args[0] ? parseInt(args[0]) : undefined;
  const roomsArg = args[1];
  const roomsMin = roomsArg ? parseFloat(roomsArg) : undefined;

  ctx.reply(`Ищу квартиры в Белграде${priceMax ? ` до ${priceMax}€` : ''}${roomsMin ? `, комнат от ${roomsMin}` : ''}...`);
  
  const [cityExpertResult, haloResult] = await Promise.allSettled([
    scrapeCityExpert({
      city: 'Belgrade',
      ...(priceMax && { priceMax }),
      ...(roomsArg && { structure: [roomsArg] })
    }),
    scrapeHaloOglasi({
      city: 'Belgrade',
      ...(priceMax && { priceMax })
    })
  ]);

  const cityExpertFlats = cityExpertResult.status === 'fulfilled' ? cityExpertResult.value : [];
  const haloFlats = haloResult.status === 'fulfilled' ? haloResult.value : [];

  let flats: Apartment[] = [...cityExpertFlats, ...haloFlats];

  if (roomsMin) {
    flats = flats.filter((flat) => (flat.rooms ?? 0) >= roomsMin);
  }

  if (flats.length === 0) {
    return ctx.reply('Ничего не найдено.');
  }

  for (const flat of flats) {
    await ctx.reply(`${flat.title}\nЦена: ${flat.price} ${flat.currency}\nЛокация: ${flat.location}\n${flat.url}`);
  }
});
