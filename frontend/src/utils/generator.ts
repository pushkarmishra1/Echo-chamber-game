import { Level, Obstacle, ExitPortal } from '../types';

/**
 * Checks if a path exists from start to exit using BFS on a 20x15 grid
 */
function hasPath(grid: boolean[][], startX: number, startY: number, endX: number, endY: number): boolean {
  if (grid.length === 0 || grid[0].length === 0) return false;
  const rows = grid.length;
  const cols = grid[0].length;
  const queue: [number, number][] = [[startX, startY]];
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  visited[startY][startX] = true;

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    if (cx === endX && cy === endY) return true;

    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        if (!grid[ny][nx] && !visited[ny][nx]) {
          visited[ny][nx] = true;
          queue.push([nx, ny]);
        }
      }
    }
  }
  return false;
}

const CHAMBER_NOUNS = [
  "Chamber", "Crypt", "Catacomb", "Void", "Hollow", "Abyss", "Sanctum", "Cell", "Labyrinth", "Den", "Tomb", "Vault", "Nexus"
];

const CHAMBER_ADJECTIVES = [
  "Shattered", "Silent", "Echoing", "Vibrating", "Forgotten", "Dark", "Spectral", "Murmuring", "Resonating", "Grave", "Chilling", "Eerie", "Haunted"
];

const CHAMBER_DESCRIPTIONS = [
  "A highly unstable architectural fold in the local sound-space.",
  "Echolocation wave propagation shows dense basalt dividers and a hidden escape gateway.",
  "Residual sonic signals indicate a highly convoluted grid. Listen closely to the bounce.",
  "The boundaries of this cell are volatile. Move with precision to avoid critical structural damage."
];

/**
 * Generates a completely procedural level with random hidden walls using Math.random()
 * while guaranteeing playability using BFS path checking.
 */
export function generateRandomLevel(levelNumber: number): Level {
  const cols = 24;
  const rows = 13;
  const cellWidth = 40;
  const cellHeight = 40;

  // Player starts at top-left: grid cell (1, 1), center coordinates ~ (60, 60)
  const startX = 1;
  const startY = 1;

  // 1. Randomized Exit Portal coordinates with safe distance constraint
  let exitX = 22;
  let exitY = 11;
  let foundExit = false;
  let attemptsExit = 0;
  while (!foundExit && attemptsExit < 300) {
    attemptsExit++;
    const rx = Math.floor(Math.random() * (cols - 2)) + 1; // cells 1 to 22
    const ry = Math.floor(Math.random() * (rows - 2)) + 1; // cells 1 to 11
    const dist = Math.sqrt(Math.pow(rx - startX, 2) + Math.pow(ry - startY, 2));
    if (dist >= 13) {
      exitX = rx;
      exitY = ry;
      foundExit = true;
    }
  }

  // 1.5 Generate Exit Portals list (Real and potentially Fake ones if level >= 40)
  const exitPortals: ExitPortal[] = [];
  const realPortal: ExitPortal = {
    id: 'portal_real',
    x: exitX * cellWidth + 20,
    y: exitY * cellHeight + 20,
    radius: 20,
    isReal: true
  };
  exitPortals.push(realPortal);

  if (levelNumber >= 40) {
    let fakePortalsPlaced = 0;
    let fakeAttempts = 0;
    while (fakePortalsPlaced < 2 && fakeAttempts < 250) {
      fakeAttempts++;
      const rx = Math.floor(Math.random() * (cols - 2)) + 1;
      const ry = Math.floor(Math.random() * (rows - 2)) + 1;

      // Ensure not too close to start, real exit, or other fake exits
      const distToStart = Math.sqrt(Math.pow(rx - startX, 2) + Math.pow(ry - startY, 2));
      const distToReal = Math.sqrt(Math.pow(rx - exitX, 2) + Math.pow(ry - exitY, 2));

      let tooCloseToOthers = false;
      for (const p of exitPortals) {
        const pxCell = Math.floor((p.x - 20) / cellWidth);
        const pyCell = Math.floor((p.y - 20) / cellHeight);
        const dist = Math.sqrt(Math.pow(rx - pxCell, 2) + Math.pow(ry - pyCell, 2));
        if (dist < 4) {
          tooCloseToOthers = true;
          break;
        }
      }

      if (distToStart >= 8 && distToReal >= 4 && !tooCloseToOthers) {
        exitPortals.push({
          id: `portal_fake_${fakePortalsPlaced}`,
          x: rx * cellWidth + 20,
          y: ry * cellHeight + 20,
          radius: 20,
          isReal: false
        });
        fakePortalsPlaced++;
      }
    }
  }

  // 2. Buffer zones to make sure start and all portal areas are completely clear
  const isBufferZone = (cx: number, cy: number) => {
    // Keep start clear (2 cells buffer)
    if (Math.abs(cx - startX) <= 2 && Math.abs(cy - startY) <= 2) return true;
    // Keep all portals clear (2 cells buffer around real and fake portals)
    for (const p of exitPortals) {
      const pxCell = Math.floor((p.x - 20) / cellWidth);
      const pyCell = Math.floor((p.y - 20) / cellHeight);
      if (Math.abs(cx - pxCell) <= 2 && Math.abs(cy - pyCell) <= 2) return true;
    }
    return false;
  };

  const grid = Array.from({ length: rows }, () => Array(cols).fill(false));

  // 3. Scaling Difficulty Wall Selection: Cap at 65, or 35% density maximum (105 cells)
  const numWalls = Math.min(65, 4 + Math.floor(levelNumber * 1.3));

  // Helper to verify if a wall structure can be placed with at least 40px (1 cell) spacing from other walls
  const canPlaceStructure = (cx: number, cy: number, cw: number, ch: number): boolean => {
    if (cx + cw > cols || cy + ch > rows) return false;

    // Check overlap with existing walls and buffer zones
    for (let dy = 0; dy < ch; dy++) {
      for (let dx = 0; dx < cw; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (grid[ny][nx] || isBufferZone(nx, ny)) return false;
      }
    }

    // Spacing check: no other walls in the surrounding cells
    for (let dy = 0; dy < ch; dy++) {
      for (let dx = 0; dx < cw; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;

        for (let sy = ny - 1; sy <= ny + 1; sy++) {
          for (let sx = nx - 1; sx <= nx + 1; sx++) {
            if (sx >= 0 && sx < cols && sy >= 0 && sy < rows) {
              const isInsideStructure = sx >= cx && sx < cx + cw && sy >= cy && sy < cy + ch;
              if (!isInsideStructure && grid[sy][sx]) {
                return false; // Violates spacing!
              }
            }
          }
        }
      }
    }

    return true;
  };

  let placedCount = 0;
  let occupiedCells = 0;
  let attempts = 0;
  const maxAttempts = 800;

  while (placedCount < numWalls && attempts < maxAttempts && occupiedCells < 105) {
    attempts++;

    // Generate random coordinates (cx, cy) on the grid map
    const cx = Math.floor(Math.random() * cols);
    const cy = Math.floor(Math.random() * rows);

    // Determine random width and height of the wall structure (1 to 2 cells)
    const sizeChance = levelNumber >= 16 ? 0.8 : 0.65;
    const cw = Math.random() > sizeChance ? 2 : 1;
    const ch = Math.random() > sizeChance ? 2 : 1;

    // Density check
    if (occupiedCells + (cw * ch) > 105) {
      continue;
    }

    if (canPlaceStructure(cx, cy, cw, ch)) {
      // Temporarily place the wall structure on the grid
      for (let dy = 0; dy < ch; dy++) {
        for (let dx = 0; dx < cw; dx++) {
          grid[cy + dy][cx + dx] = true;
        }
      }

      // Verify path playability to all portals (real & fake)
      let pathExistsToAll = true;
      for (const p of exitPortals) {
        const pxCell = Math.floor((p.x - 20) / cellWidth);
        const pyCell = Math.floor((p.y - 20) / cellHeight);
        if (!hasPath(grid, startX, startY, pxCell, pyCell)) {
          pathExistsToAll = false;
          break;
        }
      }

      if (pathExistsToAll) {
        placedCount++;
        occupiedCells += (cw * ch);
      } else {
        // Revert if path is blocked
        for (let dy = 0; dy < ch; dy++) {
          for (let dx = 0; dx < cw; dx++) {
            grid[cy + dy][cx + dx] = false;
          }
        }
      }
    }
  }

  // Convert grid cells to Obstacle objects
  const obstacles: Obstacle[] = [];
  let idCounter = 1;

  // Determine dynamic moving obstacles and velocity mathematically based on level
  const maxMovingObstacles = Math.min(8, Math.floor(levelNumber / 2));
  const movementSpeed = Math.min(150, 45 + levelNumber * 5);

  let movingCount = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x]) {
        const wallX = x * cellWidth;
        const wallY = y * cellHeight;

        let isMoving = false;
        let vx = 0;
        let vy = 0;
        let minX = wallX;
        let maxX = wallX;
        let minY = wallY;
        let maxY = wallY;

        // Procedurally allocate motion to a subset of the walls
        if (movingCount < maxMovingObstacles && Math.random() < 0.4) {
          isMoving = true;
          movingCount++;
          const horizontal = Math.random() > 0.5;
          const range = 100; // range of movement

          if (horizontal) {
            vx = Math.random() > 0.5 ? movementSpeed : -movementSpeed;
            minX = Math.max(40, wallX - range);
            maxX = Math.min(cols * cellWidth - 40 - cellWidth, wallX + range);
          } else {
            vy = Math.random() > 0.5 ? movementSpeed : -movementSpeed;
            minY = Math.max(40, wallY - range);
            maxY = Math.min(rows * cellHeight - 40 - cellHeight, wallY + range);
          }
        }

        obstacles.push({
          id: `rand_wall_${idCounter++}`,
          x: wallX,
          y: wallY,
          width: cellWidth,
          height: cellHeight,
          label: isMoving ? "HAZARD" : (Math.random() > 0.90 ? "Pillar" : undefined),
          isMoving,
          vx: isMoving && vx !== 0 ? vx : undefined,
          vy: isMoving && vy !== 0 ? vy : undefined,
          minX: isMoving ? minX : undefined,
          maxX: isMoving ? maxX : undefined,
          minY: isMoving ? minY : undefined,
          maxY: isMoving ? maxY : undefined
        });
      }
    }
  }

  // Generate atmospheric procedurally randomized level names
  const adj = CHAMBER_ADJECTIVES[Math.floor(Math.random() * CHAMBER_ADJECTIVES.length)];
  const noun = CHAMBER_NOUNS[Math.floor(Math.random() * CHAMBER_NOUNS.length)];
  const desc = CHAMBER_DESCRIPTIONS[Math.floor(Math.random() * CHAMBER_DESCRIPTIONS.length)];

  return {
    id: levelNumber,
    name: `${adj} ${noun}`,
    description: desc,
    playerStart: { x: startX * cellWidth + 20, y: startY * cellHeight + 20 },
    exitPortal: realPortal,
    exitPortals,
    obstacles
  };
}
