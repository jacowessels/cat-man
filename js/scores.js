// High scores. Any score store has the same two async methods:
//   submit({ name, score, level }) -> { rank }   (rank is null if not in the table)
//   top(n) -> [{ name, score, level, date }]
// LocalScoreStore keeps them in this browser. A shared online store can be
// added later with the same methods, without changing the game.
export const MAX_NAME_LENGTH = 12;
const SCORES_KEY = 'catman.scores.v1';
const NAME_KEY = 'catman.lastName';

export function sanitizeName(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

export function safeLocalStorage() {
  try {
    const s = globalThis.localStorage;
    const k = '__catman_test__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return memoryStorage();
  }
}

function compare(a, b) {
  return b.score - a.score || b.level - a.level || a.date - b.date;
}

export class LocalScoreStore {
  constructor(storage = safeLocalStorage(), maxEntries = 10) {
    this.storage = storage;
    this.maxEntries = maxEntries;
  }

  read() {
    try {
      const list = JSON.parse(this.storage.getItem(SCORES_KEY) || '[]');
      if (!Array.isArray(list)) return [];
      return list
        .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score))
        .map((e) => ({
          name: sanitizeName(e.name) || 'Player',
          score: Math.max(0, Math.floor(e.score)),
          level: Number.isFinite(e.level) ? e.level : 1,
          date: Number.isFinite(e.date) ? e.date : 0,
        }))
        .sort(compare);
    } catch {
      return [];
    }
  }

  write(list) {
    try {
      this.storage.setItem(SCORES_KEY, JSON.stringify(list));
    } catch {
      // storage full or blocked: scores just won't persist
    }
  }

  async submit({ name, score, level = 1 }) {
    const entry = {
      name: sanitizeName(name) || 'Player',
      score: Math.max(0, Math.floor(score) || 0),
      level,
      date: Date.now(),
    };
    const list = this.read();
    list.push(entry);
    list.sort(compare);
    const index = list.indexOf(entry);
    const kept = list.slice(0, this.maxEntries);
    this.write(kept);
    return { rank: index < this.maxEntries ? index + 1 : null };
  }

  async top(n = this.maxEntries) {
    return this.read().slice(0, n);
  }

  getLastName() {
    try {
      return sanitizeName(this.storage.getItem(NAME_KEY) || '');
    } catch {
      return '';
    }
  }

  setLastName(name) {
    try {
      this.storage.setItem(NAME_KEY, sanitizeName(name));
    } catch {
      // ignore
    }
  }
}
