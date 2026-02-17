import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export function getMediaDir(): string {
  return path.join(app.getPath('userData'), 'media');
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
