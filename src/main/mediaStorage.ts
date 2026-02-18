import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export function getMediaDir(): string {
  return path.join(app.getPath('userData'), 'media');
}

function getDirSizeBytes(dirPath: string): number {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dirPath, e.name);
    if (e.isDirectory()) {
      size += getDirSizeBytes(full);
    } else {
      try {
        size += fs.statSync(full).size;
      } catch {
        // Skip files we can't stat (e.g. permission issues)
      }
    }
  }
  return size;
}

/** Returns total app storage size in bytes (database + media). */
export function getStorageSizeBytes(): number {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'messages.db');
  const mediaDir = getMediaDir();
  let total = 0;
  if (fs.existsSync(dbPath)) {
    total += fs.statSync(dbPath).size;
  }
  total += getDirSizeBytes(mediaDir);
  return total;
}

export function ensureMediaDir(): void {
  const dir = getMediaDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function clearMediaStorage(): void {
  const dir = getMediaDir();
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}
