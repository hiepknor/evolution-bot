import Database from '@tauri-apps/plugin-sql';
import { MIGRATIONS } from '@/lib/db/schema';

let dbPromise: Promise<Database> | null = null;
let migrationPromise: Promise<void> | null = null;

const runMigrations = async (db: Database): Promise<void> => {
  for (const sql of MIGRATIONS) {
    await db.execute(sql);
  }
};

export const getDb = async (): Promise<Database> => {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:evo_broadcast_control.db');
  }

  const db = await dbPromise;
  if (!migrationPromise) {
    migrationPromise = runMigrations(db);
  }
  await migrationPromise;

  return db;
};

export const initDb = async (): Promise<void> => {
  await getDb();
};
