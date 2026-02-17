import { Telegraf } from 'telegraf';
import { scrapeCityExpert } from './scrapers/cityexpert.js';
import type { Apartment } from './types.js';

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined');
}

export const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply(
  'Привет! Я помогу тебе найти квартиру в Сербии.\n\n' +
  'Используй команду /search с параметрами:\n' +
  '/search [цена_макс] [кол-во_комнат]\n\n' +
  'Примеры:\n' +
  '/search 500 1.5 (до 500€, мин 1.5 комнаты)\n' +
  '/search 1000 (до 1000€, любые комнаты)'
));

bot.command('search', async (ctx) => {
  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const priceMax = args[0] ? parseInt(args[0]) : undefined;
  const rooms = args[1] ? [args[1]] : undefined;

  ctx.reply(`Ищу квартиры в Белграде${priceMax ? ` до ${priceMax}€` : ''}${rooms ? `, комнат: ${rooms[0]}` : ''}...`);
  
  const flats: Apartment[] = await scrapeCityExpert({ 
    city: 'Belgrade', 
    ...(priceMax && { priceMax }),
    ...(rooms && { structure: rooms })
  });

  if (flats.length === 0) {
    return ctx.reply('Ничего не найдено.');
  }

  for (const flat of flats) {
    await ctx.reply(`${flat.title}\nЦена: ${flat.price} ${flat.currency}\nЛокация: ${flat.location}\n${flat.url}`);
  }
});