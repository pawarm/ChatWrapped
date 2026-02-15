import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fix Meta's encoding: they JSON-escape UTF-8 bytes as \u00XX, so JSON.parse produces
 * mojibake (Polish chars like Å›, emojis like ðº). Reinterpret code points as bytes
 * and decode as UTF-8. Matches any UTF-8 lead byte (0xC0-0xFF) + continuation (0x80-0xBF).
 */
export function fixMetaEncoding(str: string): string {
  if (!str) return str;
  if (!/[\u00C0-\u00FF][\u0080-\u00BF]/.test(str)) return str;
  return Buffer.from(str, 'latin1').toString('utf-8');
}
