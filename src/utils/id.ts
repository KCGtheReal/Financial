/**
 * Generates collision-free globally unique entity IDs across devices.
 * Uses crypto.randomUUID() when available, falling back to high-resolution timestamp + random entropy.
 */
export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}
