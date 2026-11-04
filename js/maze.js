// The back-yard maze. One character per tile:
//   #  hedge (wall)        .  mouse        o  catnip (power-up)
//   -  kennel door         H  kennel floor C  cat start (empty)
//   (space) empty path
// Row 9 is open at both edges: it is a tunnel that wraps around.
export const MAZE_TEMPLATE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '####.#.......#.####',
  '####.#.##-##.#.####',
  '.....#.#HHH#.#.....',
  '####.#.#####.#.####',
  '####.#.......#.####',
  '####.#.#####.#.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....C.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];

export const KENNEL_EXIT = { x: 9, y: 7 };
export const KENNEL_DOOR = { x: 9, y: 8 };
export const KENNEL_CENTER = { x: 9, y: 9 };
export const DOG_HOMES = [
  { x: 9, y: 7 }, // the first dog starts outside, ready to chase
  { x: 9, y: 9 },
  { x: 8, y: 9 },
  { x: 10, y: 9 },
];
export const FISH_SPOT = { x: 9, y: 11 };
export const TUNNEL_ROW = 9;

export class Maze {
  constructor(template = MAZE_TEMPLATE) {
    this.rows = template.length;
    this.cols = template[0].length;
    this.grid = [];
    this.catStart = null;
    this.mice = 0;
    this.catnip = 0;
    for (let y = 0; y < this.rows; y++) {
      if (template[y].length !== this.cols) {
        throw new Error(`Maze row ${y} has length ${template[y].length}, expected ${this.cols}`);
      }
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        let ch = template[y][x];
        if (ch === 'C') {
          this.catStart = { x, y };
          ch = ' ';
        }
        if (ch === '.') this.mice++;
        if (ch === 'o') this.catnip++;
        row.push(ch);
      }
      this.grid.push(row);
    }
    if (!this.catStart) throw new Error('Maze has no cat start (C)');
    this.totalMice = this.mice;
  }

  wrapX(x) {
    return ((x % this.cols) + this.cols) % this.cols;
  }

  get(x, y) {
    if (y < 0 || y >= this.rows) return '#';
    return this.grid[y][this.wrapX(x)];
  }

  isWall(x, y) {
    return this.get(x, y) === '#';
  }

  catCanEnter(x, y) {
    const c = this.get(x, y);
    return c !== '#' && c !== '-' && c !== 'H';
  }

  dogCanEnter(x, y, allowKennel) {
    const c = this.get(x, y);
    if (c === '#') return false;
    if (!allowKennel && (c === '-' || c === 'H')) return false;
    return true;
  }

  isTunnel(x, y) {
    return y === TUNNEL_ROW && (x <= 3 || x >= this.cols - 4);
  }

  // Removes and returns the item on a tile ('.' or 'o'), or null.
  eat(x, y) {
    if (y < 0 || y >= this.rows) return null;
    const wx = this.wrapX(x);
    const c = this.grid[y][wx];
    if (c === '.' || c === 'o') {
      this.grid[y][wx] = ' ';
      if (c === '.') this.mice--;
      else this.catnip--;
      return c;
    }
    return null;
  }
}
