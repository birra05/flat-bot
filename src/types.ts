export interface Apartment {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  size?: number;
  floor?: number;
  rooms?: number;
  url: string;
  source: string;
  imageUrl?: string;
  publishedAt: Date;
}

export interface SearchParams {
  city: string;
  priceMin?: number;
  priceMax?: number;
  structure?: string[]; // Array of strings like "1.0", "1.5"
}
