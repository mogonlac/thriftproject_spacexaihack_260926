import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SEED_ITEMS } from "./seed";
import type { AiLogEntry, Item, ReceiptLine } from "./types";

// Zero-setup demo database shared by both apps when Supabase isn't configured.
// Plain JSON files in one folder (repo-root .data/ by default), so an item the
// scanner saves shows up in the storefront on the same machine.
//
// Every mutation takes a lock file, re-reads, applies the change and writes
// atomically (tmp file + rename), so the two dev servers can safely take turns.
// On Vercel only /tmp is writable, so there it is per-instance and ephemeral.

export const DATA_DIR =
  process.env.THRIFT_DATA_DIR ||
  (process.env.VERCEL ? "/tmp/thrift-data" : path.resolve(process.cwd(), "..", ".data"));

export const PHOTO_DIR = path.join(DATA_DIR, "photos");

export interface StoredReceipt {
  id: string;
  created_at: string;
  status: "open" | "closed";
  total_pence: number;
  lines: Omit<ReceiptLine, "size_label" | "colour" | "photo">[];
}

const FILES = {
  items: path.join(DATA_DIR, "items.json"),
  receipts: path.join(DATA_DIR, "receipts.json"),
  logs: path.join(DATA_DIR, "ai_logs.json"),
};

type Tables = { items: Item[]; receipts: StoredReceipt[]; logs: AiLogEntry[] };
type Table = keyof Tables;

function initial<T extends Table>(table: T): Tables[T] {
  // A fresh demo store starts with the seed stock on the rails.
  return (table === "items" ? structuredClone(SEED_ITEMS) : []) as Tables[T];
}

async function read<T extends Table>(table: T): Promise<Tables[T]> {
  try {
    return JSON.parse(await fs.readFile(FILES[table], "utf8")) as Tables[T];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return initial(table);
    // A read raced another process's rename on Windows — try once more.
    await new Promise((r) => setTimeout(r, 25));
    try {
      return JSON.parse(await fs.readFile(FILES[table], "utf8")) as Tables[T];
    } catch {
      return initial(table);
    }
  }
}

async function write<T extends Table>(table: T, rows: Tables[T]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = FILES[table];
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt < 8 && (code === "EPERM" || code === "EBUSY" || code === "EACCES")) {
        await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
        continue;
      }
      await fs.rm(tmp, { force: true });
      throw err;
    }
  }
}

/** Cross-process lock: exclusive-create a .lock file; break it if it's stale. */
async function withLock<R>(file: string, fn: () => Promise<R>): Promise<R> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const lock = `${file}.lock`;
  for (let attempt = 0; ; attempt++) {
    try {
      await (await fs.open(lock, "wx")).close();
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const age = await fs.stat(lock).then((s) => Date.now() - s.mtimeMs).catch(() => 0);
      if (age > 3000 || attempt > 150) await fs.rm(lock, { force: true });
      else await new Promise((r) => setTimeout(r, 20));
    }
  }
  try {
    return await fn();
  } finally {
    await fs.rm(lock, { force: true });
  }
}

// Serialise mutations within this process too (cheaper than contending on the lock).
let queue: Promise<unknown> = Promise.resolve();

export function mutate<T extends Table, R>(table: T, fn: (rows: Tables[T]) => { rows: Tables[T]; result: R }): Promise<R> {
  const run = queue.then(() =>
    withLock(FILES[table], async () => {
      const { rows, result } = fn(await read(table));
      await write(table, rows);
      return result;
    }),
  );
  queue = run.catch(() => undefined);
  return run;
}

export const localDb = {
  items: () => read("items"),
  receipts: () => read("receipts"),
  logs: () => read("logs"),
  mutate,
};

/** Save a JPEG for local mode; served by each app at /api/photos/<name>. */
export async function savePhoto(name: string, jpeg: Buffer): Promise<string> {
  await fs.mkdir(PHOTO_DIR, { recursive: true });
  await fs.writeFile(path.join(PHOTO_DIR, name), jpeg);
  return `/api/photos/${name}`;
}

/** Returns the photo bytes, or null if the name is invalid or missing. */
export async function readPhoto(name: string): Promise<Buffer | null> {
  if (!/^[\w-]+\.jpg$/.test(name)) return null;
  try {
    return await fs.readFile(path.join(PHOTO_DIR, name));
  } catch {
    return null;
  }
}
