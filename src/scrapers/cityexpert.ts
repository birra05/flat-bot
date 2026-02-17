import axios from 'axios';
import type { Apartment, SearchParams } from '../types.js';

export async function scrapeCityExpert(params: SearchParams): Promise<Apartment[]> {
    try {
        const structure = params.structure?.map(s => s.includes('.') ? s : `${s}.0`);

        const reqPayload: any = {
            cityId: 1,
            rentOrSale: "r",
            searchSource: "regular",
            sort: "datedsc",
        };

        if (params.priceMin) reqPayload.minPrice = params.priceMin;
        if (params.priceMax) reqPayload.maxPrice = params.priceMax;
        if (structure) reqPayload.structure = structure;
        
        console.log("CityExpert Payload:", JSON.stringify(reqPayload));
        const url = `https://cityexpert.rs/api/Search?req=${encodeURIComponent(JSON.stringify(reqPayload))}`;
        
        console.log("CityExpert Request:", url);

        const { data } = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'sr-RS,sr;q=0.9,ru;q=0.8,en;q=0.7',
                'Referer': 'https://www.google.rs/',
                'Origin': 'https://www.google.rs'
            }
        });

        const items = data.result || [];

        return items.map((item: any) => {
            // Construct URL manually since urlPath is missing
            // Pattern: /ru/properties-for-rent/belgrade/{propId}/{slug}
            // We'll use the ID which should potentially work, or try to construct a basic slug
            const typeSlug = item.rentOrSale === 's' ? 'properties-for-sale' : 'properties-for-rent';
            const citySlug = 'belgrade'; 
            
            // Construct a slug: {structure}-rooms-apartment-{street}-{municipality}
            // Example: 2-5-rooms-apartment-bulevar-kralja-aleksandra-zvezdara
            const structureSlug = (item.structure || '').replace('.', '-');
            const streetSlug = (item.street || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            const municipalitySlug = (item.municipality || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            
            const slug = `${structureSlug}-rooms-apartment-${streetSlug}-${municipalitySlug}`;
            
            const constructedUrl = `https://cityexpert.rs/ru/${typeSlug}/${citySlug}/${item.propId}/${slug}`;

            return {
                id: item.propId?.toString() || item.id?.toString() || 'unknown',
                title: `${item.structure || 'Квартира'}, ${item.size || '?'}m²`,
                price: item.price || 0,
                currency: 'EUR',
                location: `${item.street || ''}, ${item.municipality || ''}`,
                size: parseFloat(item.size) || 0,
                floor: parseFloat(item.floor) || 0,
                rooms: parseFloat(item.structure) || 0,
                url: constructedUrl,
                source: 'cityexpert',
                imageUrl: item.coverImage ? `https://img.cityexpert.rs/sites/default/files/${item.coverImage}` : undefined,
                publishedAt: new Date()
            };
        });

    } catch (error: any) {
        console.error("Error in scrapeCityExpert:", error.message);
        return [];
    }
}
