import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function newId(prefix: string): string {
  const bytes = randomBytes(12);
  let encoded = "";
  for (const byte of bytes) {
    encoded += ALPHABET[byte % ALPHABET.length];
  }
  return `${prefix}_${encoded}`;
}

export function requestId(): string {
  return newId("req");
}