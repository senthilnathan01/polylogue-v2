import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Report } from '../types';

interface StoreShape {
  reports: Report[];
  usageByDate: Record<string, number>;
  alertsSentByDate: Record<string, boolean>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'report-store.json');
const TEMP_FILE = `${STORE_FILE}.tmp`;

const EMPTY_STORE: StoreShape = {
  reports: [],
  usageByDate: {},
  alertsSentByDate: {},
};

async function ensureStore(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_FILE, 'utf8');
  } catch {
    await writeFile(STORE_FILE, JSON.stringify(EMPTY_STORE, null, 2), 'utf8');
  }
}

export async function readStore(): Promise<StoreShape> {
  await ensureStore();

  try {
    const raw = await readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreShape>;

    return {
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      usageByDate:
        parsed.usageByDate && typeof parsed.usageByDate === 'object'
          ? parsed.usageByDate
          : {},
      alertsSentByDate:
        parsed.alertsSentByDate && typeof parsed.alertsSentByDate === 'object'
          ? parsed.alertsSentByDate
          : {},
    };
  } catch (error) {
    console.error('Failed to read local store, resetting it.', error);
    await writeStore(EMPTY_STORE);
    return EMPTY_STORE;
  }
}

export async function writeStore(store: StoreShape): Promise<void> {
  await ensureStore();
  await writeFile(TEMP_FILE, JSON.stringify(store, null, 2), 'utf8');
  await rename(TEMP_FILE, STORE_FILE);
}

export async function updateStore(
  updater: (store: StoreShape) => StoreShape | Promise<StoreShape>,
): Promise<StoreShape> {
  const current = await readStore();
  const next = await updater(current);
  await writeStore(next);
  return next;
}
