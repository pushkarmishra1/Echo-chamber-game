import React, { useRef, useEffect, useState } from 'react';
import { Level, SonarPulse, GlowState, GameStatus, Obstacle, ExitPortal } from '../types';
import { 
  playSonarPing, 
  playEchoReflection, 
  playWallThud, 
  playLevelWin, 
  startAmbientDrone, 
  stopAmbientDrone 
} from '../utils/audio';
import { Volume2, VolumeX, ShieldAlert, Sparkles, RefreshCw, Zap } from 'lucide-react';

interface GameCanvasProps {
  key?: string;
  level: Level;
  isPaused: boolean;
  isMuted: boolean;
  onLevelComplete: () => void;
  onGameOver: () => void;
  onReset: () => void;
  onPulsesUpdated: (count: number) => void;
  onSanityUpdated: (count: number) => void;
  flares: number;
  setFlares: React.Dispatch<React.SetStateAction<number>>;
  flareActive: boolean;
  setFlareActive: React.Dispatch<React.SetStateAction<boolean>>;
  vibrationEnabled: boolean;
  playerShape: 'circle' | 'triangle' | 'square';
}

const VIRTUAL_WIDTH = 960;
const VIRTUAL_HEIGHT = 520;

export default function GameCanvas({ 
  level, 
  isPaused, 
  isMuted, 
  onLevelComplete, 
  onGameOver, 
  onReset,
  onPulsesUpdated,
  onSanityUpdated,
  flares,
  setFlares,
  flareActive,
  setFlareActive,
  vibrationEnabled,
  playerShape
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountTimeRef = useRef<number>(Date.now());

  // Game internal state
  const [sanity, setSanity] = useState(3);
  const [pulsesUsed, setPulsesUsed] = useState(0);
  const [audioStarted, setAudioStarted] = useState(false);
  const [flareWarning, setFlareWarning] = useState<string | null>(null);

  const handleUseFlare = () => {
    if (flares <= 0 || flareActive || isPaused || sanity <= 0) return;

    // Check distance from player's starting point
    const px = gameStateRef.current.playerX;
    const py = gameStateRef.current.playerY;
    const startX = level.playerStart.x;
    const startY = level.playerStart.y;
    const distFromStart = Math.sqrt((px - startX) ** 2 + (py - startY) ** 2);

    if (distFromStart < 80) {
      // Prevent early-game cheating, trigger screen shake warning!
      gameStateRef.current.screenShake = 15;
      setFlareWarning("TOO CLOSE TO SPAWN POINT. MIN 80px REQUIRED.");
      setTimeout(() => {
        setFlareWarning(null);
      }, 2500);
      return;
    }

    setFlares((prev) => prev - 1);
    setFlareActive(true);

    // Spawn Super-Pulse centered at the player's current coordinates
    gameStateRef.current.flaresTracked.push({
      x: px,
      y: py,
      duration: 2.0, // exactly 2 seconds
      maxDuration: 2.0,
    });

    setTimeout(() => {
      setFlareActive(false);
    }, 2000); // exactly 2 seconds limit
  };
  
  // Keep refs of animation states to avoid React state-rebuild overhead in the game loop
  const gameStateRef = useRef({
    playerX: level.playerStart.x,
    playerY: level.playerStart.y,
    targetX: level.playerStart.x,
    targetY: level.playerStart.y,
    isMoving: false,
    pulses: [] as SonarPulse[],
    glows: {} as GlowState,
    screenShake: 0,
    lastTime: 0,
    active: true,
    obstacles: [] as Obstacle[],
    // State-controlled portals to allow dynamic removal of fake portals upon collision
    exitPortals: [] as ExitPortal[],
    // Monster / Stalker
    monsterActive: false,
    monsterX: 0,
    monsterY: 0,
    monsterTargetX: 0,
    monsterTargetY: 0,
    monsterSpeed: 0,
    monsterGlowTimer: 0,
    monsterSpeedPenaltyTimer: 0,
    monsterIsAggro: false,
    monsterHeartbeatTimer: 0,
    monsterSpottedDelayTimer: 0,
    // Glitches and Fake Portals
    screenGlitchTimer: 0,
    lastTriggeredFakePortalId: '',
    // Active Super-Pulse flares
    flaresTracked: [] as { x: number; y: number; duration: number; maxDuration: number }[],
    playerInvulnerableTimer: 0,
  });

  // Handle level change resets
  useEffect(() => {
    gameStateRef.current.playerX = level.playerStart.x;
    gameStateRef.current.playerY = level.playerStart.y;
    gameStateRef.current.targetX = level.playerStart.x;
    gameStateRef.current.targetY = level.playerStart.y;
    gameStateRef.current.isMoving = false;
    gameStateRef.current.pulses = [];
    gameStateRef.current.glows = {};
    gameStateRef.current.screenShake = 0;
    gameStateRef.current.flaresTracked = [];
    gameStateRef.current.playerInvulnerableTimer = 0;
    gameStateRef.current.monsterSpottedDelayTimer = 0;
    
    // Safely deep clone the level's procedural obstacles so we can animate coordinates in real-time
    gameStateRef.current.obstacles = JSON.parse(JSON.stringify(level.obstacles)) as Obstacle[];

    // Safely deep clone the level's exitPortals so we can remove fake ones dynamically
    const basePortals = level.exitPortals && level.exitPortals.length > 0 
      ? level.exitPortals 
      : [level.exitPortal];
    gameStateRef.current.exitPortals = JSON.parse(JSON.stringify(basePortals)) as ExitPortal[];

    // Initialize Monster/Stalker state
    const hasMonster = level.id >= 30;
    gameStateRef.current.monsterActive = hasMonster;
    gameStateRef.current.monsterHeartbeatTimer = 0;
    if (hasMonster) {
      gameStateRef.current.monsterX = level.exitPortal.x;
      gameStateRef.current.monsterY = level.exitPortal.y;
      gameStateRef.current.monsterTargetX = level.exitPortal.x;
      gameStateRef.current.monsterTargetY = level.exitPortal.y;
      gameStateRef.current.monsterSpeed = Math.min(85, 45 + (level.id - 30) * 1.5);
      gameStateRef.current.monsterGlowTimer = 0;
      gameStateRef.current.monsterSpeedPenaltyTimer = 0;
      gameStateRef.current.monsterIsAggro = false;
    } else {
      gameStateRef.current.monsterX = 0;
      gameStateRef.current.monsterY = 0;
      gameStateRef.current.monsterTargetX = 0;
      gameStateRef.current.monsterTargetY = 0;
      gameStateRef.current.monsterSpeed = 0;
      gameStateRef.current.monsterGlowTimer = 0;
      gameStateRef.current.monsterSpeedPenaltyTimer = 0;
      gameStateRef.current.monsterIsAggro = false;
    }

    gameStateRef.current.screenGlitchTimer = 0;
    gameStateRef.current.lastTriggeredFakePortalId = '';

    setSanity(3);
    setPulsesUsed(0);
  }, [level]);

  // Handle sanity and pulse updates upwards to App component HUD
  useEffect(() => {
    onSanityUpdated(sanity);
  }, [sanity, onSanityUpdated]);

  useEffect(() => {
    onPulsesUpdated(pulsesUsed);
  }, [pulsesUsed, onPulsesUpdated]);

  // Handle sanity loss / Game Over side effects safely outside the render/updater cycle
  useEffect(() => {
    if (sanity <= 0) {
      onGameOver();
    }
  }, [sanity, onGameOver]);

  // Audio start trigger on first gesture
  const triggerAudioInit = () => {
    if (!audioStarted && !isMuted) {
      startAmbientDrone();
      setAudioStarted(true);
    }
  };

  useEffect(() => {
    return () => {
      stopAmbientDrone();
    };
  }, []);

  // Main Canvas Render and Update loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gameStateRef.current.active = true;
    let animationFrameId: number;

    const gameLoop = (timestamp: number) => {
      const state = gameStateRef.current;
      
      if (isPaused) {
        state.lastTime = timestamp; // reset lastTime to avoid massive dt jump on unpause
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      if (!state.active) return;

      if (!state.lastTime) {
        state.lastTime = timestamp;
      }
      const dt = (timestamp - state.lastTime) / 1000; // seconds
      state.lastTime = timestamp;

      // Ensure dt isn't huge (e.g. if page is backgrounded)
      const cappedDt = Math.min(dt, 0.1);

      // Halt player movement if sanity is depleted
      if (sanity <= 0) {
        state.isMoving = false;
        state.targetX = state.playerX;
        state.targetY = state.playerY;
      }

      // --- Update Physics ---

      // Decay player invulnerability timer
      if (state.playerInvulnerableTimer > 0) {
        state.playerInvulnerableTimer -= cappedDt;
        if (state.playerInvulnerableTimer < 0) {
          state.playerInvulnerableTimer = 0;
        }
      }
      
      // Update moving obstacles
      for (const obs of state.obstacles) {
        if (obs.isMoving) {
          if (obs.vx) {
            obs.x += obs.vx * cappedDt;
            if (obs.x <= (obs.minX ?? 0)) {
              obs.x = obs.minX ?? 0;
              obs.vx = -obs.vx;
            } else if (obs.x >= (obs.maxX ?? VIRTUAL_WIDTH)) {
              obs.x = obs.maxX ?? VIRTUAL_WIDTH;
              obs.vx = -obs.vx;
            }
          }
          if (obs.vy) {
            obs.y += obs.vy * cappedDt;
            if (obs.y <= (obs.minY ?? 0)) {
              obs.y = obs.minY ?? 0;
              obs.vy = -obs.vy;
            } else if (obs.y >= (obs.maxY ?? VIRTUAL_HEIGHT)) {
              obs.y = obs.maxY ?? VIRTUAL_HEIGHT;
              obs.vy = -obs.vy;
            }
          }

          // 1. Continuous Hazard Collision Loop:
          // Bounding-box intersection check (AABB collision) between moving hazard and player
          if (state.playerInvulnerableTimer <= 0 && sanity > 0) {
            const playerRadius = 9;
            const pMinX = state.playerX - playerRadius;
            const pMaxX = state.playerX + playerRadius;
            const pMinY = state.playerY - playerRadius;
            const pMaxY = state.playerY + playerRadius;

            const obsMinX = obs.x;
            const obsMaxX = obs.x + obs.width;
            const obsMinY = obs.y;
            const obsMaxY = obs.y + obs.height;

            const overlaps = pMinX < obsMaxX && pMaxX > obsMinX && pMinY < obsMaxY && pMaxY > obsMinY;

            if (overlaps) {
              // 2. Idle Hit Registration & Hazard Penalty
              state.playerInvulnerableTimer = 1.0; // 1 second invulnerability cooldown
              state.screenShake = 15; // Trigger screen shake
              state.screenGlitchTimer = 0.5; // Flash screen red using existing screen glitch mechanism

              // Apply damage (1 life point or 25 points depending on scale)
              setSanity((prev) => {
                const isPercentage = prev > 3;
                const damage = isPercentage ? 25 : 1;
                return Math.max(0, prev - damage);
              });

              if (!isMuted) {
                playWallThud();
              }

              if (vibrationEnabled && navigator.vibrate) {
                navigator.vibrate([150, 80, 150]);
              }

              // Set the hit hazard's glow to maximum immediately to visualize the threat
              state.glows[obs.id] = 1.0;
            }
          }
        }
      }
      
      // 1. Update screen shake decay
      if (state.screenShake > 0) {
        state.screenShake -= cappedDt * 15;
        if (state.screenShake < 0) state.screenShake = 0;
      }

      // 2. Update player movement with look-ahead collision
      if (state.isMoving && sanity > 0) {
        const dx = state.targetX - state.playerX;
        const dy = state.targetY - state.playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 4) {
          state.playerX = state.targetX;
          state.playerY = state.targetY;
          state.isMoving = false;
        } else {
          const moveSpeed = 160; // virtual pixels per sec
          const step = moveSpeed * cappedDt;
          const ndx = dx / dist;
          const ndy = dy / dist;

          const nextX = state.playerX + ndx * step;
          const nextY = state.playerY + ndy * step;

          // Check if next position collides with any level obstacles (8px player radius margin)
          let collided = false;
          let hitWallId = '';
          const playerRadius = 9;

          for (const obs of state.obstacles) {
            // Find closest point on obstacle rect to the player center
            const cx = Math.max(obs.x, Math.min(nextX, obs.x + obs.width));
            const cy = Math.max(obs.y, Math.min(nextY, obs.y + obs.height));
            
            const pDx = nextX - cx;
            const pDy = nextY - cy;
            const pDist = Math.sqrt(pDx * pDx + pDy * pDy);

            if (pDist < playerRadius) {
              collided = true;
              hitWallId = obs.id;
              break;
            }
          }

          if (collided) {
            // Player bumps into wall!
            state.isMoving = false;
            state.targetX = state.playerX;
            state.targetY = state.playerY;
            state.screenShake = 12; // Shake screen

            if (!isMuted) {
              playWallThud();
            }

            // Trigger web vibration API
            if (vibrationEnabled && navigator.vibrate) {
              navigator.vibrate([150, 80, 150]);
            }

            // Lights up the collided wall instantly as a feedback indicator
            state.glows[hitWallId] = 1.0;

            // Reduce Sanity (1 life point) if not invulnerable
            if (state.playerInvulnerableTimer <= 0) {
              setSanity((prev) => {
                const isPercentage = prev > 3;
                const damage = isPercentage ? 25 : 1;
                return Math.max(0, prev - damage);
              });
              state.playerInvulnerableTimer = 1.0; // 1s cooldown
            }
          } else {
            // Safe to move
            state.playerX = nextX;
            state.playerY = nextY;

            // Check if player reached exit (including state-controlled fake portals)
            const portalsToCheck = state.exitPortals;

            let reachedPortal: ExitPortal | null = null;
            for (const portal of portalsToCheck) {
              const eDx = state.playerX - portal.x;
              const eDy = state.playerY - portal.y;
              const eDist = Math.sqrt(eDx * eDx + eDy * eDy);
              if (eDist <= portal.radius + 6) {
                reachedPortal = portal;
                break;
              }
            }

            if (reachedPortal) {
              state.isMoving = false;
              state.targetX = state.playerX;
              state.targetY = state.playerY;

              if (reachedPortal.isReal !== false) {
                // Real exit!
                state.active = false; // Immediately pause animation loop to prevent multiple triggers
                if (!isMuted) {
                  playLevelWin();
                }
                setTimeout(() => {
                  onLevelComplete();
                }, 0);
              } else {
                // Fake exit!
                const portalId = reachedPortal.id || 'unknown';
                if (state.lastTriggeredFakePortalId !== portalId) {
                  state.lastTriggeredFakePortalId = portalId;
                  
                  // Flash screen red glitch
                  state.screenGlitchTimer = 0.6;
                  state.screenShake = 25;

                  if (!isMuted) {
                    playWallThud();
                  }
                  if (vibrationEnabled && navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                  }

                  // Penalty: Decrease the existing sanity state by a chunk (deduct 1 life / 25 points depending on scale)
                  setSanity((prev) => {
                    const isPercentage = prev > 3;
                    const damage = isPercentage ? 25 : 1;
                    return Math.max(0, prev - damage);
                  });

                  // IMMEDIATELY remove that specific Fake Vortex from the array/level so it doesn't drain sanity completely in a single frame.
                  state.exitPortals = state.exitPortals.filter(p => p.id !== portalId);

                  // Supplementary flare/monster penalty
                  if (flares > 0) {
                    setFlares((prev) => Math.max(0, prev - 1));
                  } else {
                    // Speed penalty for monster
                    state.monsterSpeedPenaltyTimer = 7.0;
                  }

                  // Bounce player back
                  const bounceDist = 18;
                  const dxPlayer = state.playerX - reachedPortal.x;
                  const dyPlayer = state.playerY - reachedPortal.y;
                  const distPlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);
                  if (distPlayer > 0) {
                    state.playerX = reachedPortal.x + (dxPlayer / distPlayer) * (reachedPortal.radius + bounceDist);
                    state.playerY = reachedPortal.y + (dyPlayer / distPlayer) * (reachedPortal.radius + bounceDist);
                    state.targetX = state.playerX;
                    state.targetY = state.playerY;
                  }
                }
              }
            } else {
              state.lastTriggeredFakePortalId = '';
            }
          }
        }
      }

      // 2.5 Update Monster/Stalker Position & Check Player Collision
      if (state.monsterActive && sanity > 0) {
        // Calculate real-time distance between Player and Monster
        const pMDx = state.playerX - state.monsterX;
        const pMDy = state.playerY - state.monsterY;
        const pMDist = Math.sqrt(pMDx * pMDx + pMDy * pMDy);

        // Update heartbeat/ping timer (cycles every 3.0 seconds)
        state.monsterHeartbeatTimer += cappedDt;
        if (state.monsterHeartbeatTimer >= 3.0) {
          state.monsterHeartbeatTimer -= 3.0;
        }

        const aggroRadius = 75; // Reduced from 130 to 75 pixels for better balance
        if (pMDist <= aggroRadius) {
          // If Player enters the aggroRadius...
          if (!state.monsterIsAggro && state.monsterSpottedDelayTimer <= 0) {
            // Trigger spotted warning delay
            state.monsterSpottedDelayTimer = 1.5; // exactly 1.5 seconds warning pause
            state.monsterIsAggro = true; // Engage chase mode
          }

          if (state.monsterSpottedDelayTimer > 0) {
            state.monsterSpottedDelayTimer -= cappedDt;
            if (state.monsterSpottedDelayTimer < 0) {
              state.monsterSpottedDelayTimer = 0;
            }
            // During warning pause, target remains locked to player, but speed is 0
            state.monsterTargetX = state.playerX;
            state.monsterTargetY = state.playerY;
          } else {
            // Normal chase target lock
            state.monsterTargetX = state.playerX;
            state.monsterTargetY = state.playerY;
          }
        } else {
          // If Player escapes and exceeds the aggroRadius, lose track, drop aggro and revert to Patrol State
          if (state.monsterIsAggro) {
            state.monsterIsAggro = false;
            state.monsterSpottedDelayTimer = 0;
            // Instantly select a new random patrol coordinate
            state.monsterTargetX = 50 + Math.random() * (VIRTUAL_WIDTH - 100);
            state.monsterTargetY = 50 + Math.random() * (VIRTUAL_HEIGHT - 100);
          }
        }

        // Stalker movement
        const mDx = state.monsterTargetX - state.monsterX;
        const mDy = state.monsterTargetY - state.monsterY;
        const mDist = Math.sqrt(mDx * mDx + mDy * mDy);

        if (mDist > 4) {
          // Speed factor is 0 during the spotted delay warning pause
          const speedFactor = state.monsterSpottedDelayTimer > 0 ? 0 : 1;
          const currentSpeed = (state.monsterSpeedPenaltyTimer > 0 ? state.monsterSpeed * 1.6 : state.monsterSpeed) * speedFactor;
          const mStep = currentSpeed * cappedDt;
          state.monsterX += (mDx / mDist) * mStep;
          state.monsterY += (mDy / mDist) * mStep;
        } else {
          // Reached patrol target: pick another random patrol coordinate
          if (!state.monsterIsAggro) {
            state.monsterTargetX = 50 + Math.random() * (VIRTUAL_WIDTH - 100);
            state.monsterTargetY = 50 + Math.random() * (VIRTUAL_HEIGHT - 100);
          }
        }

        if (state.monsterSpeedPenaltyTimer > 0) {
          state.monsterSpeedPenaltyTimer -= cappedDt;
        }

        // Check if monster caught player
        if (pMDist < 16 && state.playerInvulnerableTimer <= 0) {
          // Sanity Armor: Deduct 1 Sanity point (or 25 points if scale is out of 100)
          const damage = sanity > 3 ? 25 : 1;
          const newSanity = Math.max(0, sanity - damage);
          setSanity(newSanity);

          if (newSanity <= 0) {
            state.active = false;
            onGameOver();
          } else {
            // Teleport monster to a random safe coordinate far away from player
            let newMX = 0;
            let newMY = 0;
            let tries = 0;
            while (tries < 100) {
              const testX = 50 + Math.random() * (VIRTUAL_WIDTH - 100);
              const testY = 50 + Math.random() * (VIRTUAL_HEIGHT - 100);
              const pDx = testX - state.playerX;
              const pDy = testY - state.playerY;
              const dist = Math.sqrt(pDx * pDx + pDy * pDy);
              if (dist >= 150) {
                let insideObstacle = false;
                for (const obs of state.obstacles) {
                  if (testX >= obs.x && testX <= obs.x + obs.width && testY >= obs.y && testY <= obs.y + obs.height) {
                    insideObstacle = true;
                    break;
                  }
                }
                if (!insideObstacle) {
                  newMX = testX;
                  newMY = testY;
                  break;
                }
              }
              tries++;
            }
            if (newMX === 0) {
              newMX = state.playerX > VIRTUAL_WIDTH / 2 ? 100 : VIRTUAL_WIDTH - 100;
              newMY = state.playerY > VIRTUAL_HEIGHT / 2 ? 100 : VIRTUAL_HEIGHT - 100;
            }

            state.monsterX = newMX;
            state.monsterY = newMY;

            // Flash screen red and apply screen shake + invulnerability
            state.screenGlitchTimer = 0.8;
            state.screenShake = 20;
            state.playerInvulnerableTimer = 1.5; // 1.5 seconds cooldown

            // Revert monster to Patrol State
            state.monsterIsAggro = false;
            state.monsterSpottedDelayTimer = 0;
            state.monsterTargetX = 50 + Math.random() * (VIRTUAL_WIDTH - 100);
            state.monsterTargetY = 50 + Math.random() * (VIRTUAL_HEIGHT - 100);

            if (!isMuted) {
              playWallThud();
            }

            if (vibrationEnabled && navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
          }
        }

        // Decay monster glow timer
        if (state.monsterGlowTimer > 0) {
          state.monsterGlowTimer -= cappedDt;
        }
      }

      // 2.6 Update active flares (Super-Pulses)
      state.flaresTracked = state.flaresTracked.filter(flare => {
        flare.duration -= cappedDt;
        return flare.duration > 0;
      });

      // Check active flares vs monster to illuminate it
      for (const flare of state.flaresTracked) {
        const dx = flare.x - state.monsterX;
        const dy = flare.y - state.monsterY;
        const distToMonster = Math.sqrt(dx * dx + dy * dy);
        if (distToMonster <= 624) {
          const progress = flare.duration / flare.maxDuration;
          state.monsterGlowTimer = Math.max(state.monsterGlowTimer, progress);
        }
      }

      // 3. Update active sonar pulses
      const updatedPulses: SonarPulse[] = [];
      for (const pulse of state.pulses) {
        pulse.radius += pulse.speed * cappedDt;
        
        // Dynamic non-linear rapid fade-out as pulse gets close to its maximum bounds
        const progress = pulse.radius / pulse.maxRadius;
        pulse.opacity = Math.max(0, Math.pow(1.0 - progress, 1.6));

        if (pulse.opacity > 0.02 && pulse.radius < pulse.maxRadius) {
          // Check collision between expanding wave ring and obstacles
          for (const obs of state.obstacles) {
            if (pulse.pingedObstacles.has(obs.id)) continue;

            const cx = Math.max(obs.x, Math.min(pulse.x, obs.x + obs.width));
            const cy = Math.max(obs.y, Math.min(pulse.y, obs.y + obs.height));
            const pDx = pulse.x - cx;
            const pDy = pulse.y - cy;
            const dist = Math.sqrt(pDx * pDx + pDy * pDy);

            // If the sonar ring has reached the closest edge of this obstacle
            if (pulse.radius >= dist && pulse.radius <= dist + 35) {
              pulse.pingedObstacles.add(obs.id);
              state.glows[obs.id] = 1.0; // Trigger high glow

              if (!isMuted) {
                // Calculate distance ratio for pitch modulation (0 = close/high pitch, 1 = far/low pitch)
                const distRatio = Math.min(dist / pulse.maxRadius, 1.0);
                const xRatio = cx / VIRTUAL_WIDTH;
                playEchoReflection(distRatio, xRatio);
              }

              if (vibrationEnabled && navigator.vibrate) {
                navigator.vibrate(20); // soft vibration
              }
            }
          }

          // Check pulse vs state-controlled active exit portals (to ignore removed fake ones)
          const portalsToCheck = state.exitPortals;

          if (!pulse.pingedExitIds) {
            pulse.pingedExitIds = new Set<string>();
          }

          for (const portal of portalsToCheck) {
            const portalId = portal.id || 'exit_portal';
            if (pulse.pingedExitIds.has(portalId)) continue;

            const dx = pulse.x - portal.x;
            const dy = pulse.y - portal.y;
            const distToExit = Math.sqrt(dx * dx + dy * dy);
            if (pulse.radius >= distToExit && pulse.radius <= distToExit + 20) {
              pulse.pingedExitIds.add(portalId);
              pulse.pingedExit = true;
              state.glows[portalId] = 1.0; // illuminate the portal's custom glow tracker

              if (!isMuted) {
                const xRatio = portal.x / VIRTUAL_WIDTH;
                playEchoReflection(0.01, xRatio); // High resonant trigger reflection
              }
            }
          }

          updatedPulses.push(pulse);
        }
      }
      state.pulses = updatedPulses;

      // 4. Update obstacle/portal glow state decays
      for (const id in state.glows) {
        if (state.glows[id] > 0) {
          // Slow geometric decay rate to keep the outlines lingering beautifully in dark water
          state.glows[id] -= cappedDt * 0.42; 
          if (state.glows[id] < 0) state.glows[id] = 0;
        }
      }

      // --- Draw Scene ---

      // Clear layout with dark background
      ctx.fillStyle = '#010103';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Determine responsive scaling factors
      const scale = Math.min(canvas.width / VIRTUAL_WIDTH, canvas.height / VIRTUAL_HEIGHT);
      const offsetX = (canvas.width - VIRTUAL_WIDTH * scale) / 2;
      const offsetY = (canvas.height - VIRTUAL_HEIGHT * scale) / 2;

      const scaleX = scale;
      const scaleY = scale;

      // Save graphics context state and shift coordinates to fit the active viewport frame
      ctx.save();
      
      // Apply screen shake displacement
      if (state.screenShake > 0) {
        const dxShake = (Math.random() - 0.5) * state.screenShake * scale;
        const dyShake = (Math.random() - 0.5) * state.screenShake * scale;
        ctx.translate(dxShake, dyShake);
      }

      // ---------------------------------------------------------
      // 1. DRAW WALLS/BLOCKS & REAL VORTEX (UNDER THE FOG):
      // Draw the inner playing boundary grid, static walls, and the REAL Exit Vortex.
      // These are drawn first so that the subsequent darkness fog hides them completely.
      // ---------------------------------------------------------
      
      // Draw Soft Gridlines
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.lineWidth = 1;
      const gridSpacing = 40 * scale;
      for (let x = offsetX; x < canvas.width - offsetX; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, offsetY);
        ctx.lineTo(x, canvas.height - offsetY);
        ctx.stroke();
      }
      for (let y = offsetY; y < canvas.height - offsetY; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(offsetX, y);
        ctx.lineTo(canvas.width - offsetX, y);
        ctx.stroke();
      }

      // Draw level bounding walls
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.strokeRect(offsetX, offsetY, VIRTUAL_WIDTH * scaleX, VIRTUAL_HEIGHT * scaleY);

      // Draw level obstacles underneath darkness (both static and moving, so player's light/flare reveals them)
      for (const obs of state.obstacles) {
        const ox = obs.x * scaleX + offsetX;
        const oy = obs.y * scaleY + offsetY;
        const ow = obs.width * scaleX;
        const oh = obs.height * scaleY;
        if (!obs.isMoving) {
          ctx.fillStyle = '#090d16'; // Very dark grey core for static walls
          ctx.fillRect(ox, oy, ow, oh);
        } else {
          ctx.save();
          ctx.fillStyle = '#ef4444'; // Red hazard fill for moving obstacles
          ctx.fillRect(ox, oy, ow, oh);
          if (obs.label) {
            ctx.fillStyle = '#fca5a5';
            ctx.font = `bold ${Math.max(6, 9 * scaleX)}px monospace`;
            ctx.fillText(obs.label.toUpperCase(), ox + 6 * scaleX, oy + oh - 10 * scaleY);
          }
          ctx.restore();
        }
      }

      // Draw ALL Exit Portals (both real and fake) underneath the fog
      for (const portal of state.exitPortals) {
        const ex = portal.x * scaleX + offsetX;
        const ey = portal.y * scaleY + offsetY;
        const er = portal.radius * scaleX;

        ctx.save();
        const time = Date.now() / 30; // Speed of the spin
        ctx.beginPath();
        ctx.strokeStyle = '#00ffff'; // Neon Cyan
        ctx.shadowColor = '#00ffff'; // Neon Cyan shadow
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.setLineDash([15, 10]); // Create energy dashes
        ctx.lineDashOffset = -time; // Animate dashes to look like it's spinning
        ctx.stroke();

        // Inner core
        const coreGradient = ctx.createRadialGradient(ex, ey, 2 * scaleX, ex, ey, er);
        coreGradient.addColorStop(0, 'rgba(255, 0, 255, 0.4)'); // Purple neon core
        coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
        ctx.fillStyle = coreGradient;
        ctx.fill();
        ctx.restore();
      }

      // ---------------------------------------------------------
      // 2. DRAW THE FOG OF WAR (DARKNESS):
      // Create a radial gradient centered exactly on the player to cover the screen.
      // This successfully hides the exit portals and walls unless the player is close.
      // ---------------------------------------------------------
      ctx.save();
      const px = state.playerX * scaleX + offsetX;
      const py = state.playerY * scaleY + offsetY;
      const visionRadius = flareActive ? 800 * scaleX : 100 * scaleX;
      const darkGrad = ctx.createRadialGradient(px, py, 2, px, py, visionRadius);
      darkGrad.addColorStop(0, 'rgba(2, 3, 5, 0.0)');
      darkGrad.addColorStop(0.3, 'rgba(2, 3, 5, 0.3)');
      darkGrad.addColorStop(0.8, 'rgba(2, 3, 5, 0.93)');
      darkGrad.addColorStop(1, 'rgba(2, 3, 5, 0.98)');
      ctx.fillStyle = darkGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // ---------------------------------------------------------
      // 3. DRAW GLOWING REVEALED STRUCTURES & ACTIVE SONAR/GLOWS ON TOP:
      // Draw thick expanding sonar pulses, glowing revealed walls, and glowing revealed portals on top of the darkness.
      // ---------------------------------------------------------

      // Draw thick glowing sonar pulses
      for (const pulse of state.pulses) {
        ctx.save();
        ctx.strokeStyle = '#4ade80'; // Glowing green sonar wave
        ctx.lineWidth = 4 * scaleX;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#4ade80';
        ctx.globalAlpha = pulse.opacity;
        ctx.beginPath();
        ctx.arc(pulse.x * scaleX + offsetX, pulse.y * scaleY + offsetY, pulse.radius * scaleX, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw illuminated/glowing walls (both static and moving) on top of darkness if they are pinged
      for (const obs of state.obstacles) {
        const glow = state.glows[obs.id] || 0;
        if (glow > 0.04) {
          const ox = obs.x * scaleX + offsetX;
          const oy = obs.y * scaleY + offsetY;
          const ow = obs.width * scaleX;
          const oh = obs.height * scaleY;
          ctx.save();
          ctx.globalAlpha = glow;
          ctx.fillStyle = obs.isMoving ? '#ef4444' : '#10b981'; // Red glow for moving hazards, green for static blocks
          ctx.fillRect(ox, oy, ow, oh);
          if (obs.label && glow > 0.3) {
            ctx.fillStyle = obs.isMoving ? '#fca5a5' : '#f8fafc';
            ctx.font = `bold ${Math.max(6, 9 * scaleX)}px monospace`;
            ctx.fillText(obs.label.toUpperCase(), ox + 6 * scaleX, oy + oh - 10 * scaleY);
          }
          ctx.restore();
        }
      }

      // Draw illuminated/glowing portals (both real and fake) on top of darkness if they are pinged
      for (const portal of state.exitPortals) {
        const portalId = portal.id || 'exit_portal';
        const glow = state.glows[portalId] || 0;
        if (glow > 0.04) {
          const ex = portal.x * scaleX + offsetX;
          const ey = portal.y * scaleY + offsetY;
          const er = portal.radius * scaleX;
          
          ctx.save();
          ctx.globalAlpha = glow;
          // Outer Ring
          const time = Date.now() / 30;
          ctx.beginPath();
          ctx.strokeStyle = '#00ffff';
          ctx.shadowColor = '#00ffff';
          ctx.arc(ex, ey, er, 0, Math.PI * 2);
          ctx.lineWidth = 4;
          ctx.shadowBlur = 20;
          ctx.setLineDash([15, 10]);
          ctx.lineDashOffset = -time;
          ctx.stroke();
          ctx.restore();

          // Inner Core
          ctx.save();
          ctx.globalAlpha = glow * (0.6 + Math.sin(Date.now() / 200) * 0.3);
          const innerRadius = er * 0.45;
          ctx.beginPath();
          ctx.fillStyle = '#ff00ff';
          ctx.shadowColor = '#ff00ff';
          ctx.arc(ex, ey, innerRadius, 0, Math.PI * 2);
          ctx.shadowBlur = 15;
          ctx.fill();
          ctx.restore();
        }
      }

      // ---------------------------------------------------------
      // 4. DRAW PLAYER CORE & MONSTER (ON TOP):
      // Ensure we draw the player core and the monster on top of darkness.
      // ---------------------------------------------------------
      ctx.globalCompositeOperation = 'source-over';

      // Draw Player Avatar (glowing energy core)
      ctx.save();
      const drawPlayerShape = (c: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
        c.beginPath();
        if (playerShape === 'triangle') {
          c.moveTo(cx, cy - r);
          c.lineTo(cx + r * 0.866, cy + r * 0.5);
          c.lineTo(cx - r * 0.866, cy + r * 0.5);
          c.closePath();
        } else if (playerShape === 'square') {
          c.rect(cx - r, cy - r, r * 2, r * 2);
        } else { // circle
          c.arc(cx, cy, r, 0, Math.PI * 2);
        }
      };

      const beaconPulse = 0.35 + Math.sin(timestamp / 300) * 0.12;
      ctx.save();
      ctx.fillStyle = `rgba(34, 211, 238, ${beaconPulse * 0.12})`; // cyan beacon aura
      ctx.beginPath();
      drawPlayerShape(ctx, px, py, 26 * scaleX);
      ctx.fill();
      ctx.restore();

      const isInvuln = state.playerInvulnerableTimer > 0;
      const shouldRenderCore = !isInvuln || (Math.floor(timestamp / 80) % 2 === 0);

      if (shouldRenderCore && sanity > 0) {
        ctx.save();
        // 1. Glowing outer aura (Neon Green #4ade80)
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#4ade80';
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        drawPlayerShape(ctx, px, py, 9 * scaleX);
        ctx.fill();
        ctx.restore();

        ctx.save();
        // 2. Solid inner core (White #ffffff)
        ctx.shadowBlur = 0; // Disable shadow blur for core crispness
        ctx.fillStyle = isInvuln ? '#a5f3fc' : '#ffffff';
        ctx.beginPath();
        drawPlayerShape(ctx, px, py, 5 * scaleX);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Draw Stalker Monster (only visible if monster is illuminated/pinged, heartbeat is active, or spotted delay is active)
      const isHeartbeatActive = state.monsterActive && (state.monsterHeartbeatTimer < 0.5);
      const isSpottedActive = state.monsterActive && (state.monsterSpottedDelayTimer > 0);
      const heartbeatOpacity = isHeartbeatActive ? Math.max(0, (0.5 - state.monsterHeartbeatTimer) / 0.5) : 0;
      const spottedOpacity = isSpottedActive ? 1.0 : 0;
      const mOpacity = Math.max(Math.min(1.0, state.monsterGlowTimer), heartbeatOpacity, spottedOpacity);

      if (state.monsterActive && (state.monsterGlowTimer > 0 || isHeartbeatActive || isSpottedActive) && sanity > 0) {
        const mX = state.monsterX * scaleX + offsetX;
        const mY = state.monsterY * scaleY + offsetY;

        ctx.save();
        ctx.shadowBlur = isSpottedActive ? 25 : 15;
        ctx.shadowColor = '#ef4444';

        // Beating red aura
        const monsterBeating = 14 + Math.sin(timestamp / 100) * 4;
        ctx.fillStyle = isSpottedActive 
          ? `rgba(220, 38, 38, ${mOpacity * 0.45})` 
          : `rgba(239, 68, 68, ${mOpacity * 0.25})`;
        ctx.beginPath();
        ctx.arc(mX, mY, monsterBeating * scaleX, 0, Math.PI * 2);
        ctx.fill();

        // Inner glitchy red core
        ctx.fillStyle = isSpottedActive 
          ? `rgba(255, 0, 0, 1.0)` 
          : `rgba(220, 38, 38, ${mOpacity * 0.95})`;
        ctx.beginPath();
        ctx.arc(mX, mY, 7 * scaleX, 0, Math.PI * 2);
        ctx.fill();

        // Warning spikes
        ctx.strokeStyle = isSpottedActive 
          ? `rgba(255, 0, 0, 1.0)` 
          : `rgba(248, 113, 113, ${mOpacity})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const angle = (timestamp / 200) + (i * Math.PI) / 2;
          const startDist = 9 * scaleX;
          const endDist = 16 * scaleX;
          ctx.beginPath();
          ctx.moveTo(mX + Math.cos(angle) * startDist, mY + Math.sin(angle) * startDist);
          ctx.lineTo(mX + Math.cos(angle) * endDist, mY + Math.sin(angle) * endDist);
          ctx.stroke();
        }

        // Scary text label
        ctx.fillStyle = isSpottedActive ? `rgba(255, 0, 0, 1.0)` : `rgba(248, 113, 113, ${mOpacity})`;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isSpottedActive ? "⚠️ ENTITY SPOTTED" : "STALKER DETECTED", mX, mY - 18 * scaleY);
        ctx.restore();

        // Danger Zone: Draw faint, hollow circle around the monster
        if (isHeartbeatActive || isSpottedActive) {
          ctx.save();
          ctx.strokeStyle = isSpottedActive 
            ? `rgba(255, 0, 0, 0.45)` 
            : `rgba(255, 0, 0, 0.22)`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]); // 5px dash, 4px space
          ctx.beginPath();
          const drawRadius = 75 * scaleX; // Match aggroRadius of 75px
          ctx.arc(mX, mY, drawRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 8.2 Draw red screen glitch flash for fake exits or hazard hit
      if (state.screenGlitchTimer > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.45, state.screenGlitchTimer * 0.95)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.3, state.screenGlitchTimer)})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const yVal = Math.random() * canvas.height;
          ctx.beginPath();
          ctx.moveTo(0, yVal);
          ctx.lineTo(canvas.width, yVal);
          ctx.stroke();
        }
        ctx.restore();

        state.screenGlitchTimer -= cappedDt;
      }

      ctx.restore(); // restore shake matrix

      // 8.5 If sanity is 0 or less, render the Game Over state directly on top of the canvas
      if (sanity <= 0) {
        ctx.save();
        // Darken the screen further
        ctx.fillStyle = 'rgba(2, 3, 5, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw glowing red Game Over text
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#ef4444';
        ctx.font = `bold ${Math.max(20, 34 * scaleX)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("SANITY LOST - GAME OVER", canvas.width / 2, canvas.height / 2 - 15);

        // Subtext
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${Math.max(10, 13 * scaleX)}px monospace`;
        ctx.fillText("COGNITIVE RECEPTORS FAILED • SIGNAL TERMINATION", canvas.width / 2, canvas.height / 2 + 30);
        ctx.restore();
      }

      // Request next animation frame
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      gameStateRef.current.active = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [level, isMuted, isPaused, onLevelComplete, onGameOver, flares, setFlares, flareActive, setFlareActive, sanity]);

  // Handle Resize of canvas container dynamically using ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleResize = (entries: ResizeObserverEntry[]) => {
      let containerWidth = 0;
      let containerHeight = 0;

      if (entries && entries[0]) {
        const { width, height } = entries[0].contentRect;
        containerWidth = width;
        containerHeight = height;
      } else {
        const rect = container.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
      }

      if (containerWidth <= 0 || containerHeight <= 0) return;

      // Make canvas consume 100% of available space!
      canvas.width = containerWidth;
      canvas.height = containerHeight;
    };

    const observer = new ResizeObserver((entries) => {
      requestAnimationFrame(() => handleResize(entries));
    });

    observer.observe(container);
    
    // Initial calculation
    const initialRect = container.getBoundingClientRect();
    if (initialRect.width > 0 && initialRect.height > 0) {
      canvas.width = initialRect.width;
      canvas.height = initialRect.height;
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Handle Canvas Tap Interaction
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPaused || sanity <= 0) return; // Ignore click when paused/settings is open or Game Over
    if (Date.now() - mountTimeRef.current < 250) return; // Ignore clicks immediately after mounting
    triggerAudioInit();

    // Try locking orientation on user interaction
    try {
      const orient = screen.orientation as any;
      if (orient && typeof orient.lock === 'function') {
        orient.lock('landscape').catch(() => {});
      }
    } catch (_) {}

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Scale back to virtual coordinate system preserving uniform aspect ratio
    const scale = Math.min(canvas.width / VIRTUAL_WIDTH, canvas.height / VIRTUAL_HEIGHT);
    const offsetX = (canvas.width - VIRTUAL_WIDTH * scale) / 2;
    const offsetY = (canvas.height - VIRTUAL_HEIGHT * scale) / 2;

    const vX = (clickX - offsetX) / scale;
    const vY = (clickY - offsetY) / scale;

    // 1. Fire Sonar Pulse at tap coordinate
    // Determine dynamic pulse speed and max radius based on current level difficulty
    let speed = 250;
    let maxRadius = 300;
    if (level.id <= 5) {
      maxRadius = 300;
      speed = 250;
    } else if (level.id <= 15) {
      maxRadius = 190;
      speed = 220;
    } else {
      maxRadius = 110; // pure dark horror
      speed = 190;
    }
    
    const newPulse: SonarPulse = {
      id: Math.random().toString(),
      x: vX,
      y: vY,
      radius: 0,
      maxRadius,
      speed,
      opacity: 1.0,
      color: '#22d3ee', // Cyan-400
      pingedObstacles: new Set<string>(),
      pingedExit: false
    };

    gameStateRef.current.pulses.push(newPulse);
    setPulsesUsed((prev) => prev + 1);

    // Play procedural sound for sonar ping
    if (!isMuted) {
      const xRatio = vX / VIRTUAL_WIDTH;
      playSonarPing(xRatio);
    }

    // 2. Set moving target for the player
    gameStateRef.current.targetX = vX;
    gameStateRef.current.targetY = vY;
    gameStateRef.current.isMoving = true;
  };

  return (
    <div ref={containerRef} className="flex-1 w-full h-full relative bg-[#010103] overflow-hidden select-none">
      {/* Absolute Pitch Black Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-crosshair block"
        id="game-canvas-screen"
      />

      {/* Flare Warning Toast Overlay */}
      {flareWarning && (
        <div id="flare-warning-toast" className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-red-950/80 border border-red-800 text-red-300 px-4 py-2 rounded-xl text-[10px] font-mono tracking-widest uppercase shadow-2xl animate-bounce z-30">
          ⚠️ {flareWarning}
        </div>
      )}

      {/* Floating Flare Action Button */}
      <div id="flare-action-controls" className="absolute bottom-4 right-4 z-20 flex flex-col items-end space-y-1 select-none">
        <button
          id="btn-trigger-flare"
          onClick={handleUseFlare}
          disabled={flares === 0 || flareActive || isPaused || sanity <= 0}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shadow-xl border cursor-pointer ${
            flareActive
              ? 'bg-amber-500 text-black border-amber-400 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]'
              : flares > 0
                ? 'bg-[#151105]/90 hover:bg-[#2e2307] text-amber-400 hover:text-amber-300 border-amber-500 hover:border-amber-500/50 shadow-[0_4px_12px_rgba(0,0,0,0.5)] transform hover:-translate-y-0.5 active:translate-y-0'
                : 'bg-black/40 text-slate-600 border-slate-900/80 cursor-not-allowed'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${flareActive ? 'animate-spin' : 'text-amber-500'}`} />
          <span>
            {flareActive 
              ? "SUPER-PULSE ACTIVE" 
              : flares > 0 
                ? `SUPER-FLARE (${flares})` 
                : "NO FLARES"}
          </span>
        </button>
        {flareActive && (
          <span id="txt-flare-duration" className="text-[8px] font-mono tracking-widest text-amber-500 uppercase animate-pulse pr-1">
            2S ILLUMINATION BURST
          </span>
        )}
      </div>

      {/* Ambient atmospheric warning on start */}
      {!audioStarted && !isMuted && (
        <div id="audio-starter-overlay" className="absolute inset-0 bg-black/70 backdrop-blur-[1.5px] flex flex-col justify-center items-center p-6 pointer-events-none text-center">
          <div id="audio-starter-card" className="max-w-md bg-[#04060c] border border-cyan-900/30 rounded-2xl p-6 shadow-2xl space-y-3">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-widest font-mono">EMISSION GRID SECURED</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tap anywhere on the dark grid terminal to dispatch a sonar ping and initiate movement. 
            </p>
            <div className="text-[9px] font-mono text-cyan-500 animate-pulse uppercase">
              Click viewport to begin navigation
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
