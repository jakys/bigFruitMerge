import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CustomFruitSet, CustomImageEntry } from '../types/index.ts';

interface DaxiguaDB extends DBSchema {
  fruitSets: {
    key: 'current';
    value: CustomFruitSet;
  };
}

const DB_NAME = 'daxigua-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DaxiguaDB>> | null = null;

function getDb(): Promise<IDBPDatabase<DaxiguaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DaxiguaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('fruitSets')) {
          db.createObjectStore('fruitSets');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveCustomFruitSet(images: CustomImageEntry[]): Promise<void> {
  const db = await getDb();
  const set: CustomFruitSet = {
    id: 'current',
    images,
    createdAt: Date.now(),
  };
  await db.put('fruitSets', set, 'current');
}

export async function loadCustomFruitSet(): Promise<CustomFruitSet | null> {
  const db = await getDb();
  return (await db.get('fruitSets', 'current')) ?? null;
}

export async function clearCustomFruitSet(): Promise<void> {
  const db = await getDb();
  await db.delete('fruitSets', 'current');
}

export async function readImageDimensions(file: File): Promise<{ width: number; height: number; bitmap: ImageBitmap }> {
  const bitmap = await createImageBitmap(file);
  return { width: bitmap.width, height: bitmap.height, bitmap };
}

export async function sortAndPrepareImages(files: File[]): Promise<CustomImageEntry[]> {
  const entries = await Promise.all(
    files.map(async (file) => {
      const { width, height, bitmap } = await readImageDimensions(file);
      bitmap.close();
      return {
        blob: file,
        width,
        height,
        sortIndex: 0,
        name: file.name.replace(/\.[^.]+$/, ''),
        area: width * height,
      };
    }),
  );

  entries.sort((a, b) => a.area - b.area);

  return entries.map((entry, sortIndex) => ({
    blob: entry.blob,
    width: entry.width,
    height: entry.height,
    sortIndex,
    name: entry.name,
  }));
}

export async function customSetToBitmaps(set: CustomFruitSet): Promise<Map<number, ImageBitmap>> {
  const map = new Map<number, ImageBitmap>();
  for (const img of set.images) {
    const bitmap = await createImageBitmap(img.blob);
    map.set(img.sortIndex, bitmap);
  }
  return map;
}
