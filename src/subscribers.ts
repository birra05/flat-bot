import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.resolve('data/subscribers.json');

export class SubscriberStorage {
  private subscribers: Set<string> = new Set();
  private loaded = false;

  async load() {
    if (this.loaded) return;

    try {
      const data = await fs.readFile(DB_PATH, 'utf-8');
      const chatIds = JSON.parse(data) as string[];
      this.subscribers = new Set(chatIds.map((id) => String(id)));
    } catch {
      this.subscribers = new Set();
      await this.save();
    }

    this.loaded = true;
  }

  async save() {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(Array.from(this.subscribers), null, 2));
  }

  async getAll(): Promise<string[]> {
    await this.load();
    return Array.from(this.subscribers);
  }

  async add(chatId: string): Promise<boolean> {
    await this.load();
    const before = this.subscribers.size;
    this.subscribers.add(chatId);
    const changed = this.subscribers.size !== before;
    if (changed) await this.save();
    return changed;
  }

  async remove(chatId: string): Promise<boolean> {
    await this.load();
    const changed = this.subscribers.delete(chatId);
    if (changed) await this.save();
    return changed;
  }
}

export const subscriberStorage = new SubscriberStorage();
