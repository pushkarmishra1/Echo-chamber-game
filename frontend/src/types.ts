export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  isTrigger?: boolean; // e.g. trap or special trigger
  vx?: number;         // movement velocity X
  vy?: number;         // movement velocity Y
  minX?: number;       // boundary for X movement
  maxX?: number;
  minY?: number;       // boundary for Y movement
  maxY?: number;
  isMoving?: boolean;
}

export interface ExitPortal {
  x: number;
  y: number;
  radius: number;
  isReal?: boolean;
  id?: string;
}

export interface SonarPulse {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  opacity: number;
  color: string;
  // Track which obstacle IDs this pulse has already triggered a "ping" for
  pingedObstacles: Set<string>;
  pingedExit: boolean;
  pingedExitIds?: Set<string>; // to support multiple portals
}

export interface GlowState {
  // Map obstacle ID / portal ID -> current glow intensity (0.0 to 1.0)
  [obstacleId: string]: number;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  playerStart: { x: number; y: number };
  exitPortal: ExitPortal;
  exitPortals?: ExitPortal[]; // For Level >= 40 (Fake and Real Portals)
  obstacles: Obstacle[];
}

export type GameStatus = 'WELCOME' | 'READY' | 'PLAYING' | 'SETTINGS' | 'GAMEOVER' | 'WON';
