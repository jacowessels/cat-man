// Draws everything on the canvas. Drawing uses tile units: 1 = one tile.
import { isNone } from './movement.js';

const COLORS = {
  ground: '#141b2e',
  hedgeDark: '#1f6b3a',
  hedgeLight: '#2f9a55',
  hedgeTop: '#46b96d',
  kennel: '#3a2a20',
  door: '#f28cb1',
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tile = 24;
    this.dpr = 1;
    this.wallLayer = null;
    this.mouseSprite = null;
    this.mazeKey = null;
  }

  resize(maze, maxWidth, maxHeight) {
    const tile = Math.max(8, Math.floor(Math.min(maxWidth / maze.cols, maxHeight / maze.rows)));
    this.tile = tile;
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    const w = maze.cols * tile;
    const h = maze.rows * tile;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.wallLayer = null;
    this.mouseSprite = null;
  }

  scale() {
    return this.tile * this.dpr;
  }

  makeLayer(drawFn, wTiles, hTiles) {
    const s = this.scale();
    const c = document.createElement('canvas');
    c.width = Math.ceil(wTiles * s);
    c.height = Math.ceil(hTiles * s);
    const g = c.getContext('2d');
    g.setTransform(s, 0, 0, s, 0, 0);
    drawFn(g);
    return c;
  }

  buildWalls(maze) {
    this.wallLayer = this.makeLayer((g) => {
      g.fillStyle = COLORS.ground;
      g.fillRect(0, 0, maze.cols, maze.rows);
      // A few grass speckles on the ground for texture.
      g.fillStyle = 'rgba(120,160,255,0.05)';
      for (let i = 0; i < maze.cols * maze.rows * 0.6; i++) {
        const x = (i * 7.31) % maze.cols;
        const y = (i * 3.17 + (i % 5) * 0.37) % maze.rows;
        g.fillRect(x, y, 0.05, 0.05);
      }
      for (let y = 0; y < maze.rows; y++) {
        for (let x = 0; x < maze.cols; x++) {
          const c = maze.grid[y][x];
          if (c === 'H') {
            g.fillStyle = COLORS.kennel;
            g.fillRect(x, y, 1, 1);
          }
        }
      }
      const layers = [
        [0.1, COLORS.hedgeDark],
        [0.2, COLORS.hedgeLight],
        [0.34, COLORS.hedgeTop],
      ];
      for (const [inset, color] of layers) {
        g.fillStyle = color;
        for (let y = 0; y < maze.rows; y++) {
          for (let x = 0; x < maze.cols; x++) {
            if (maze.grid[y][x] !== '#') continue;
            const wall = (dx, dy) => {
              const yy = y + dy;
              const xx = x + dx;
              return yy >= 0 && yy < maze.rows && xx >= 0 && xx < maze.cols && maze.grid[yy][xx] === '#';
            };
            const size = 1 - inset * 2;
            roundRect(g, x + inset, y + inset, size, size, Math.min(0.25, size / 2));
            g.fill();
            if (wall(1, 0)) g.fillRect(x + 0.5, y + inset, 1, size);
            if (wall(0, 1)) g.fillRect(x + inset, y + 0.5, size, 1);
            if (wall(1, 0) && wall(0, 1) && wall(1, 1)) g.fillRect(x + 0.5, y + 0.5, 1, 1);
          }
        }
      }
      // Kennel door
      for (let y = 0; y < maze.rows; y++) {
        for (let x = 0; x < maze.cols; x++) {
          if (maze.grid[y][x] === '-') {
            g.fillStyle = COLORS.door;
            g.fillRect(x, y + 0.42, 1, 0.16);
          }
        }
      }
    }, maze.cols, maze.rows);
  }

  buildMouse() {
    this.mouseSprite = this.makeLayer((g) => drawMouse(g, 0.5, 0.5, 1), 1, 1);
  }

  draw(game) {
    const { ctx } = this;
    const maze = game.maze;
    if (!maze) return;
    if (!this.wallLayer) this.buildWalls(maze);
    if (!this.mouseSprite) this.buildMouse();
    const s = this.scale();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.wallLayer, 0, 0);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    const t = game.time;
    // Mice and catnip
    for (let y = 0; y < maze.rows; y++) {
      for (let x = 0; x < maze.cols; x++) {
        const c = maze.grid[y][x];
        if (c === '.') ctx.drawImage(this.mouseSprite, x, y, 1, 1);
        else if (c === 'o') drawCatnip(ctx, x + 0.5, y + 0.5, t);
      }
    }

    if (game.fish) {
      const blink = game.fish.ttl < 2 && Math.floor(t * 8) % 2 === 0;
      if (!blink) drawFish(ctx, game.fish.x + 0.5, game.fish.y + 0.5, t);
    }

    const flashing = game.isScared && game.scaredTimer < 2 && Math.floor(t * 6) % 2 === 0;
    const hideDogs = game.state === 'dying' && t - game.deathTime > 0.6;
    if (!hideDogs) {
      for (const d of game.dogs) {
        wrapDraw(maze, d.x, (xx) => {
          let bob = 0;
          if (d.state === 'house') bob = Math.sin(t * 5 + d.index) * 0.12;
          drawDog(ctx, xx + 0.5, d.y + 0.5 + bob, d, flashing, t);
        });
      }
    }

    // Cat
    const cat = game.cat;
    wrapDraw(maze, cat.x, (xx) => {
      if (game.state === 'dying') {
        const k = Math.min(1, (t - game.deathTime) / 1.6);
        drawCat(ctx, xx + 0.5, cat.y + 0.5, cat.dir, 0, t, k);
      } else {
        const mouth = isNone(cat.dir) ? 0.15 : (Math.sin(game.mouthTime * 22) + 1) / 2;
        drawCat(ctx, xx + 0.5, cat.y + 0.5, game.lastFacing(), mouth, t, 0);
      }
    });

    // Points popups
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of game.popups) {
      ctx.globalAlpha = Math.min(1, p.ttl * 2);
      ctx.font = 'bold 0.6px system-ui, sans-serif';
      ctx.lineWidth = 0.12;
      ctx.strokeStyle = '#000';
      ctx.strokeText(p.text, p.x + 0.5, p.y + 0.5 - (1.2 - p.ttl) * 0.6);
      ctx.fillStyle = '#7ef9ff';
      ctx.fillText(p.text, p.x + 0.5, p.y + 0.5 - (1.2 - p.ttl) * 0.6);
    }
    ctx.globalAlpha = 1;

    if (game.banner) {
      const y = game.state === 'levelClear' ? 9.5 : 11.5;
      ctx.font = 'bold 0.95px system-ui, sans-serif';
      ctx.lineWidth = 0.2;
      ctx.strokeStyle = '#000';
      ctx.strokeText(game.banner, maze.cols / 2, y);
      ctx.fillStyle = game.state === 'levelClear' ? '#7ef9ff' : '#ffd23f';
      ctx.fillText(game.banner, maze.cols / 2, y);
    }
  }
}

function wrapDraw(maze, x, fn) {
  fn(x);
  if (x > maze.cols - 1) fn(x - maze.cols);
  if (x < 0) fn(x + maze.cols);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function ellipse(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

export function drawMouse(g, cx, cy, scale = 1) {
  g.save();
  g.translate(cx, cy);
  g.scale(scale, scale);
  // tail
  g.strokeStyle = '#e8a0b4';
  g.lineWidth = 0.035;
  g.beginPath();
  g.moveTo(-0.12, 0.02);
  g.quadraticCurveTo(-0.24, -0.1, -0.27, 0.06);
  g.stroke();
  // body
  g.fillStyle = '#b9bec7';
  ellipse(g, -0.01, 0.03, 0.13, 0.09);
  g.fill();
  // head
  ellipse(g, 0.1, 0.0, 0.08, 0.065);
  g.fill();
  // ears
  g.fillStyle = '#f3b6c8';
  ellipse(g, 0.07, -0.07, 0.04, 0.04);
  g.fill();
  ellipse(g, 0.13, -0.065, 0.035, 0.035);
  g.fill();
  // eye and nose
  g.fillStyle = '#111';
  ellipse(g, 0.13, -0.01, 0.014, 0.014);
  g.fill();
  g.fillStyle = '#f07aa0';
  ellipse(g, 0.18, 0.01, 0.017, 0.017);
  g.fill();
  g.restore();
}

function drawCatnip(g, cx, cy, t) {
  const s = 1 + Math.sin(t * 6) * 0.12;
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  g.fillStyle = 'rgba(140,255,160,0.18)';
  ellipse(g, 0, 0, 0.42, 0.42);
  g.fill();
  g.strokeStyle = '#2d7a33';
  g.lineWidth = 0.05;
  g.beginPath();
  g.moveTo(0, 0.3);
  g.lineTo(0, -0.05);
  g.stroke();
  const leaves = [[-0.13, 0.08, -0.7], [0.13, 0.08, 0.7], [-0.1, -0.1, -0.4], [0.1, -0.1, 0.4], [0, -0.2, 0]];
  for (const [x, y, r] of leaves) {
    g.fillStyle = '#5fd35f';
    ellipse(g, x, y, 0.08, 0.14, r);
    g.fill();
    g.strokeStyle = '#2d7a33';
    g.lineWidth = 0.015;
    g.stroke();
  }
  g.restore();
}

function drawFish(g, cx, cy, t) {
  g.save();
  g.translate(cx, cy + Math.sin(t * 4) * 0.05);
  g.fillStyle = '#4fb3ff';
  g.beginPath();
  g.moveTo(0.22, 0);
  g.quadraticCurveTo(0.05, -0.22, -0.18, 0);
  g.quadraticCurveTo(0.05, 0.22, 0.22, 0);
  g.fill();
  g.beginPath();
  g.moveTo(-0.15, 0);
  g.lineTo(-0.35, -0.15);
  g.lineTo(-0.35, 0.15);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff';
  ellipse(g, 0.12, -0.03, 0.035, 0.035);
  g.fill();
  g.fillStyle = '#000';
  ellipse(g, 0.125, -0.03, 0.017, 0.017);
  g.fill();
  g.restore();
}

// dying: 0 = normal, 0..1 = spin and shrink away
export function drawCat(g, cx, cy, dir, mouth, t, dying = 0) {
  g.save();
  g.translate(cx, cy);
  if (dying > 0) {
    g.rotate(dying * Math.PI * 4);
    const s = Math.max(0.001, 1 - dying);
    g.scale(s, s);
  }
  const dx = dir ? dir.x : 0;
  const dy = dir ? dir.y : 0;
  // ears
  for (const side of [-1, 1]) {
    g.fillStyle = '#f08a24';
    g.beginPath();
    g.moveTo(side * 0.36, -0.12);
    g.lineTo(side * 0.33, -0.48);
    g.lineTo(side * 0.08, -0.32);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffb3c6';
    g.beginPath();
    g.moveTo(side * 0.3, -0.18);
    g.lineTo(side * 0.29, -0.39);
    g.lineTo(side * 0.14, -0.3);
    g.closePath();
    g.fill();
  }
  // head
  g.fillStyle = '#f59a3a';
  ellipse(g, 0, 0.02, 0.4, 0.36);
  g.fill();
  // stripes
  g.strokeStyle = '#c4651a';
  g.lineWidth = 0.045;
  g.lineCap = 'round';
  for (const x of [-0.1, 0, 0.1]) {
    g.beginPath();
    g.moveTo(x, -0.33);
    g.lineTo(x * 0.8, -0.2);
    g.stroke();
  }
  // muzzle
  g.fillStyle = '#fff1dc';
  ellipse(g, -0.09, 0.15, 0.12, 0.09);
  g.fill();
  ellipse(g, 0.09, 0.15, 0.12, 0.09);
  g.fill();
  // eyes
  const ex = dx * 0.04;
  const ey = dy * 0.04;
  for (const side of [-1, 1]) {
    g.fillStyle = '#d6ff6b';
    ellipse(g, side * 0.15, -0.05, 0.08, 0.09);
    g.fill();
    g.fillStyle = '#111';
    ellipse(g, side * 0.15 + ex, -0.05 + ey, 0.03, 0.07);
    g.fill();
    g.fillStyle = '#fff';
    ellipse(g, side * 0.15 + ex + 0.02, -0.08 + ey, 0.015, 0.015);
    g.fill();
  }
  // nose
  g.fillStyle = '#ff7aa2';
  g.beginPath();
  g.moveTo(-0.05, 0.07);
  g.lineTo(0.05, 0.07);
  g.lineTo(0, 0.12);
  g.closePath();
  g.fill();
  // mouth (opens while eating)
  if (mouth > 0.05) {
    g.fillStyle = '#5a1020';
    ellipse(g, 0, 0.2, 0.07, 0.03 + mouth * 0.07);
    g.fill();
    g.fillStyle = '#ff8fa8';
    ellipse(g, 0, 0.23 + mouth * 0.02, 0.04, 0.02 + mouth * 0.02);
    g.fill();
  }
  // whiskers
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 0.018;
  for (const side of [-1, 1]) {
    for (const k of [-0.04, 0.02, 0.08]) {
      g.beginPath();
      g.moveTo(side * 0.18, 0.13 + k * 0.3);
      g.lineTo(side * 0.5, 0.1 + k);
      g.stroke();
    }
  }
  g.restore();
}

export function drawDog(g, cx, cy, dog, flashing, t) {
  const type = dog.type;
  g.save();
  g.translate(cx, cy);
  const dir = dog.mover.dir || { x: 0, y: 0 };
  if (dog.state === 'eaten' || dog.state === 'entering') {
    // Just the collar and worried eyes running home.
    g.strokeStyle = '#e63946';
    g.lineWidth = 0.08;
    ellipse(g, 0, 0.18, 0.22, 0.09);
    g.stroke();
    g.fillStyle = '#ffd23f';
    ellipse(g, 0, 0.29, 0.05, 0.05);
    g.fill();
    drawDogEyes(g, dir, false);
    g.restore();
    return;
  }
  const scared = dog.scared;
  if (scared) g.translate(Math.sin(t * 40) * 0.025, 0);
  const fur = scared ? (flashing ? '#f1f5ff' : '#3a57d6') : type.fur;
  const ear = scared ? (flashing ? '#c9d4ff' : '#22379a') : type.ear;
  const snout = scared ? (flashing ? '#ffffff' : '#6d86f0') : type.snout;
  const flap = Math.sin(t * 12 + dog.index) * 0.12;
  // floppy ears
  for (const side of [-1, 1]) {
    g.fillStyle = ear;
    ellipse(g, side * 0.36, 0.02, 0.12, 0.25, side * (0.35 + flap));
    g.fill();
  }
  // head
  g.fillStyle = fur;
  ellipse(g, 0, 0, 0.34, 0.36);
  g.fill();
  if (type.spots && !scared) {
    g.fillStyle = '#2b2b2b';
    ellipse(g, 0.14, -0.18, 0.09, 0.07, 0.4);
    g.fill();
    ellipse(g, -0.2, 0.08, 0.06, 0.05);
    g.fill();
  }
  // snout
  g.fillStyle = snout;
  ellipse(g, 0, 0.17, 0.2, 0.15);
  g.fill();
  // nose
  g.fillStyle = scared ? '#111a55' : '#1a1a1a';
  ellipse(g, 0, 0.1, 0.08, 0.055);
  g.fill();
  if (scared) {
    // wobbly worried mouth
    g.strokeStyle = flashing ? '#3a57d6' : '#fff';
    g.lineWidth = 0.03;
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const x = -0.13 + i * 0.043;
      const y = 0.24 + (i % 2 ? -0.025 : 0.025);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  } else {
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 0.025;
    g.beginPath();
    g.moveTo(0, 0.15);
    g.lineTo(0, 0.22);
    g.moveTo(-0.08, 0.25);
    g.quadraticCurveTo(0, 0.2, 0.08, 0.25);
    g.stroke();
    // tongue
    g.fillStyle = '#ff6f91';
    ellipse(g, 0.03, 0.29, 0.04, 0.05);
    g.fill();
  }
  drawDogEyes(g, dir, scared);
  if (!scared) {
    // grumpy eyebrows
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 0.035;
    g.beginPath();
    g.moveTo(-0.2, -0.2);
    g.lineTo(-0.06, -0.14);
    g.moveTo(0.2, -0.2);
    g.lineTo(0.06, -0.14);
    g.stroke();
  }
  g.restore();
}

function drawDogEyes(g, dir, scared) {
  const ex = (dir.x || 0) * 0.035;
  const ey = (dir.y || 0) * 0.035;
  for (const side of [-1, 1]) {
    g.fillStyle = '#fff';
    ellipse(g, side * 0.12, -0.06, 0.07, 0.075);
    g.fill();
    g.fillStyle = scared ? '#3a57d6' : '#2a1a0a';
    ellipse(g, side * 0.12 + ex, -0.06 + ey, 0.038, 0.042);
    g.fill();
  }
}
