import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.resolve('data/seen_ids.json');

export class Storage {
  // Store smart keys instead of just IDs
  // Key format: price-size-location (normalized)
  private seenKeys: Set<string> = new Set();

  async load() {
    try {
      const data = await fs.readFile(DB_PATH, 'utf-8');
      const keys = JSON.parse(data);
      this.seenKeys = new Set(keys);
    } catch (error) {
      // If file doesn't exist, start with empty set and save to create the file
      this.seenKeys = new Set();
      await this.save();
    }
  }

  async save() {
    // Ensure directory exists
    try {
        await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    } catch (e) {
        // ignore if exists
    }
    const keys = Array.from(this.seenKeys);
    await fs.writeFile(DB_PATH, JSON.stringify(keys, null, 2));
  }

  isNew(apt: any): boolean {
    const key = this.generateKey(apt);
    return !this.seenKeys.has(key);
  }

  add(apt: any) {
    const key = this.generateKey(apt);
    this.seenKeys.add(key);
  }

  private generateKey(apt: any): string {
      // Create a smart key: Price + Size + Location + Floor + Rooms
      // Format: price-size-location-floor-rooms
      
      const price = apt.price || 0;
      
      let size = apt.size;
      // Fallback for size if missing
      if (!size && apt.title) {
          const match = apt.title.match(/(\d+)\s*m2/i);
          if (match) size = match[1];
      }
      size = parseFloat(size) || 0;

      // Normalize location
      const location = (apt.location || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const floor = apt.floor || 0;
      const rooms = apt.rooms || 0;

      const key = `${price}_${size}_${location}_${floor}_${rooms}`;
      return key;
  }
}
