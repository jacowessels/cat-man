// Difficulty settings for each level. Every value moves towards "harder"
// as the level goes up, and stops at a limit so the game stays playable.
export const LIVES_PER_LEVEL = 3;

export function levelConfig(level) {
  const n = Math.max(0, Math.floor(level) - 1);
  const catSpeed = Math.min(6.5 + n * 0.15, 8); // tiles per second
  return {
    level: n + 1,
    catSpeed,
    dogSpeed: catSpeed * Math.min(0.75 + n * 0.05, 1.0),
    scaredDogSpeed: catSpeed * 0.5,
    kennelDogSpeed: catSpeed * 0.45,
    homeRunDogSpeed: catSpeed * 2,
    tunnelDogSpeed: catSpeed * 0.45,
    catnipSeconds: Math.max(8 - n, 2),
    scatterSeconds: Math.max(7 - n, 2),
    chaseSeconds: Math.min(20 + n * 5, 45),
    dogCount: Math.min(2 + n, 4),
    releaseInterval: Math.max(4 - n * 0.5, 1),
    fishPoints: Math.min(100 * (n + 1), 1000),
    musicBpm: Math.min(132 + n * 4, 168),
  };
}
