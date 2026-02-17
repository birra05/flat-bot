import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Apartment, SearchParams } from '../types.js';

export async function scrapeHaloOglasi(params: SearchParams): Promise<Apartment[]> {
  try {
    // Construct URL based on params
    // Base URL: https://www.halooglasi.com/nekretnine/izdavanje-stanova/beograd
    let url = 'https://www.halooglasi.com/nekretnine/izdavanje-stanova/beograd';
    
    const queryParams: string[] = [];
    if (params.priceMin) queryParams.push(`cena_d_from=${params.priceMin}`);
    if (params.priceMax) queryParams.push(`cena_d_to=${params.priceMax}`);
    
    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }

    console.log(`[HaloOglasi] Fetching ${url}`);

    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'sr-RS,sr;q=0.9,ru;q=0.8,en;q=0.7',
        'Referer': 'https://www.google.rs/',
        'Cache-Control': 'max-age=0'
      }
    });

    const $ = cheerio.load(data);
    const apartments: Apartment[] = [];

    // Strategy: Extract QuidditaEnvironment.serverListData
    $('script').each((i, el) => {
      const content = $(el).html() || '';
      if (content.includes('QuidditaEnvironment.serverListData')) {
        const match = content.match(/QuidditaEnvironment\.serverListData\s*=\s*({[\s\S]*?});/);
        if (match && match[1]) {
          try {
            const jsonData = JSON.parse(match[1]);
            
            if (jsonData.Ads && Array.isArray(jsonData.Ads)) {
              jsonData.Ads.forEach((ad: any) => {
                // Decode ListHTML to extract price and size
                // Simple entity decode
                let listHtml = ad.ListHTML
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/&nbsp;/g, ' ');

                // Use Cheerio to parse the snippet
                const $item = cheerio.load(listHtml);
                
                // Extract Price
                // Often in central-feature span or similar, but the user suggested regex context `data-value="(\d+)"`
                let price = 0;
                const priceMatch = listHtml.match(/data-value="(\d+)"/);
                if (priceMatch) {
                    price = parseInt(priceMatch[1]);
                } else {
                    // Fallback to text parsing if regex fails
                    const priceText = $item('.central-feature span').text().replace(/\D/g, '');
                    price = parseInt(priceText) || 0;
                }

                // Extract Size
                // User suggested regex: (\d+)&nbsp;m<sup>2</sup>
                let size = 0;
                const sizeMatch = listHtml.match(/(\d+)\s*m<sup>2<\/sup>/) || 
                                  listHtml.match(/(\d+)\s*kvad/) ||
                                  listHtml.match(/(\d+)\s*m2/);
                
                if (sizeMatch) {
                    size = parseInt(sizeMatch[1]);
                } else {
                     // Fallback
                     const sizeText = $item('li:contains("m2")').text().replace(/\D/g, '');
                     size = parseInt(sizeText) || 0;
                }
                
                // Extract Location properly
                // Often in subtitle-places
                let location = $item('.subtitle-places').text().trim();
                // Clean up location (remove multiple spaces)
                location = location.replace(/\s+/g, ' ');

                // Extract Rooms
                // Regex: (\d+(\.\d+)?) sob or similar
                let rooms = 0;
                const roomsMatch = listHtml.match(/(\d+(\.\d+)?)\s*soba/);
                if (roomsMatch) {
                    rooms = parseFloat(roomsMatch[1]);
                } else {
                    const roomsText = $item('li:contains("soba")').text().replace(/[^\d.]/g, '');
                    rooms = parseFloat(roomsText) || 0;
                }

                // Extract Floor
                // Regex: sprat (\d+) or (\d+)\. sprat
                let floor = 0;
                const floorMatch = listHtml.match(/sprat\s*(\d+)/i) || listHtml.match(/(\d+)\.\s*sprat/i);
                if (floorMatch) {
                    floor = parseInt(floorMatch[1]);
                } else {
                    const floorText = $item('li:contains("sprat")').text().replace(/\D/g, '');
                    floor = parseInt(floorText) || 0;
                }

                apartments.push({
                  id: ad.Id.toString(),
                  title: ad.Title,
                  price: price,
                  currency: 'EUR', // HaloOglasi is usually EUR
                  location: location || 'Belgrade', // Fallback
                  size: size,
                  floor: floor,
                  rooms: rooms,
                  url: 'https://www.halooglasi.com' + ad.RelativeUrl,
                  source: 'halooglasi',
                  publishedAt: new Date(ad.ValidFrom) // or new Date()
                });
              });
            }
          } catch (e) {
            console.error('[HaloOglasi] Failed to parse Quiddita JSON:', e);
          }
        }
      }
    });
    
    console.log(`[HaloOglasi] Found ${apartments.length} ads.`);
    return apartments;

  } catch (error: any) {
    console.error('[HaloOglasi] Error:', error.message);
    return [];
  }
}
