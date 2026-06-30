import React, { useState } from 'react';
import { Copy, Check, Terminal, Cpu, Sparkles } from 'lucide-react';

export default function ReactNativeCodeView() {
  const [copied, setCopied] = useState(false);

  const nativeCode = `/**
 * EchoChamber: The Sound & Sight Horror Puzzle
 * 
 * High-Performance 2D Game Screen using React Native,
 * React Native Reanimated (v3), and @shopify/react-native-skia.
 * 
 * This implementation achieves constant 60 FPS by rendering fully on the GPU/UI thread.
 * It features procedural level generation and dynamic radial masking using Skia's <Mask> API.
 */

import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, Dimensions, TouchableOpacity } from 'react-native';
import { Canvas, Circle, Rect, Group, Mask, LinearGradient, vec } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  withTiming, 
  runOnJS, 
  useAnimatedReaction,
  Easing,
  cancelAnimation
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Get viewport dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

interface Level {
  id: number;
  name: string;
  playerStart: { x: number; y: number };
  exitPortal: { x: number; y: number; radius: number };
  obstacles: Obstacle[];
}

/**
 * Procedural Winnable Maze Generator
 * Evaluates winnability using a simple BFS pathfinder on the scaled layout grid
 */
function hasPath(grid: boolean[][], startX: number, startY: number, endX: number, endY: number): boolean {
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

function generateRandomLevel(levelNumber: number): Level {
  const cols = 10;
  const rows = 12;
  const cellWidth = SCREEN_WIDTH / cols;
  const cellHeight = (SCREEN_HEIGHT - 120) / rows;

  const startX = 0;
  const startY = 0;
  const exitX = cols - 1;
  const exitY = rows - 1;

  const grid = Array.from({ length: rows }, () => Array(cols).fill(false));
  const numWalls = Math.min(4 + levelNumber, 28);

  const isBufferZone = (x: number, y: number) => {
    if (Math.abs(x - startX) <= 1 && Math.abs(y - startY) <= 1) return true;
    if (Math.abs(x - exitX) <= 1 && Math.abs(y - exitY) <= 1) return true;
    return false;
  };

  let placed = 0;
  let attempts = 0;
  while (placed < numWalls && attempts < 200) {
    attempts++;
    const rx = Math.floor(Math.random() * cols);
    const ry = Math.floor(Math.random() * rows);

    if (grid[ry][rx] || isBufferZone(rx, ry)) continue;

    grid[ry][rx] = true;
    if (hasPath(grid, startX, startY, exitX, exitY)) {
      placed++;
    } else {
      grid[ry][rx] = false; // rollback
    }
  }

  const obstacles: Obstacle[] = [];
  let idCounter = 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x]) {
        obstacles.push({
          id: \`wall_\${idCounter++}\`,
          x: x * cellWidth,
          y: y * cellHeight + 60,
          width: cellWidth,
          height: cellHeight,
        });
      }
    }
  }

  return {
    id: levelNumber,
    name: \`Chamber \${levelNumber}\`,
    playerStart: { x: startX * cellWidth + cellWidth / 2, y: startY * cellHeight + 60 + cellHeight / 2 },
    exitPortal: { 
      x: exitX * cellWidth + cellWidth / 2, 
      y: exitY * cellHeight + 60 + cellHeight / 2, 
      radius: Math.min(cellWidth, cellHeight) / 2.2 
    },
    obstacles
  };
}

export default function GameScreen() {
  const [levelNum, setLevelNum] = useState(1);
  const level = useMemo(() => generateRandomLevel(levelNum), [levelNum]);

  // --- Reanimated Shared Values for High-Performance Animations ---
  const playerX = useSharedValue(level.playerStart.x);
  const playerY = useSharedValue(level.playerStart.y);

  const pulseX = useSharedValue(0);
  const pulseY = useSharedValue(0);
  const pulseRadius = useSharedValue(0);
  const pulseOpacity = useSharedValue(0);

  // Set of already acoustic-pinged walls to prevent double triggers
  const pingedSet = useSharedValue<string[]>([]);
  const [energy, setEnergy] = useState(1.0);
  const [levelStatus, setLevelStatus] = useState<'PLAYING' | 'WON' | 'GAMEOVER'>('PLAYING');

  const triggerHaptic = (type: 'impact' | 'sonar') => {
    if (type === 'impact') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleCollision = () => {
    setEnergy((prev) => {
      const next = prev - 0.2;
      if (next <= 0) setLevelStatus('GAMEOVER');
      return Math.max(0, next);
    });
  };

  const handleWin = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLevelStatus('WON');
  };

  // --- Worklet helper to calculate distance from circle to box ---
  const getDistanceToObstacle = (px: number, py: number, obs: Obstacle) => {
    'worklet';
    const closestX = Math.max(obs.x, Math.min(px, obs.x + obs.width));
    const closestY = Math.max(obs.y, Math.min(py, obs.y + obs.height));
    const dX = px - closestX;
    const dY = py - closestY;
    return Math.sqrt(dX * dX + dY * dY);
  };

  // --- Real-Time Audio-Haptic Wave Interaction Loop (Runs at 60fps on UI Thread) ---
  useAnimatedReaction(
    () => pulseRadius.value,
    (radius) => {
      if (radius === 0) return;

      level.obstacles.forEach((obs) => {
        const dist = getDistanceToObstacle(pulseX.value, pulseY.value, obs);
        if (radius >= dist && radius <= dist + 35) {
          const list = pingedSet.value;
          if (!list.includes(obs.id)) {
            pingedSet.value = [...list, obs.id];
            runOnJS(triggerHaptic)('sonar');
          }
        }
      });
    }
  );

  // --- Touch Gesture: Pulse & Move ---
  const tapGesture = Gesture.Tap()
    .onStart((event) => {
      if (levelStatus !== 'PLAYING') return;

      const tx = event.x;
      const ty = event.y;

      // 1. Trigger expanding sonar pulse on touch
      cancelAnimation(pulseRadius);
      cancelAnimation(pulseOpacity);
      pulseX.value = tx;
      pulseY.value = ty;
      pulseRadius.value = 0;
      pulseOpacity.value = 1.0;
      pingedSet.value = [];

      pulseRadius.value = withTiming(380, { duration: 1600, easing: Easing.out(Easing.quad) });
      pulseOpacity.value = withTiming(0.0, { duration: 1600 });

      // 2. Compute Segment Collision & Player Movement path
      let collision = false;
      let targetX = tx;
      let targetY = ty;

      const steps = 30;
      for (let i = 1; i <= steps; i++) {
        const ratio = i / steps;
        const testX = playerX.value + (tx - playerX.value) * ratio;
        const testY = playerY.value + (ty - playerY.value) * ratio;

        for (const obs of level.obstacles) {
          if (
            testX >= obs.x - 12 &&
            testX <= obs.x + obs.width + 12 &&
            testY >= obs.y - 12 &&
            testY <= obs.y + obs.height + 12
          ) {
            collision = true;
            const backRatio = Math.max(0, (i - 2) / steps);
            targetX = playerX.value + (tx - playerX.value) * backRatio;
            targetY = playerY.value + (ty - playerY.value) * backRatio;
            break;
          }
        }
        if (collision) break;
      }

      const dist = Math.sqrt(Math.pow(targetX - playerX.value, 2) + Math.pow(targetY - playerY.value, 2));
      const duration = (dist / 200) * 1000; // 200 units/sec

      playerX.value = withTiming(targetX, { duration, easing: Easing.linear });
      playerY.value = withTiming(targetY, { duration, easing: Easing.linear }, (finished) => {
        if (finished && collision) {
          runOnJS(triggerHaptic)('impact');
          runOnJS(handleCollision)();
        } else if (finished && !collision) {
          const dx = targetX - level.exitPortal.x;
          const dy = targetY - level.exitPortal.y;
          const distToExit = Math.sqrt(dx * dx + dy * dy);
          if (distToExit <= level.exitPortal.radius + 15) {
            runOnJS(handleWin)();
          }
        }
      });
    });

  const nextChamber = () => {
    setLevelNum((p) => p + 1);
    setEnergy(1.0);
    setLevelStatus('PLAYING');
    playerX.value = level.playerStart.x;
    playerY.value = level.playerStart.y;
  };

  const restartRoom = () => {
    setEnergy(1.0);
    setLevelStatus('PLAYING');
    playerX.value = level.playerStart.x;
    playerY.value = level.playerStart.y;
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={tapGesture}>
        <View style={styles.gameArea}>
          
          <Canvas style={StyleSheet.absoluteFill}>
            {/* 1. Dynamic Radial Mask Layer (Composed purely on GPU thread!) */}
            <Mask
              mode="luminance"
              mask={
                <Group>
                  {/* Background absolute black default */}
                  <Rect x={0} y={0} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} color="black" />
                  
                  {/* Sonar Ring reveals anything underneath it */}
                  <Circle
                    cx={pulseX}
                    cy={pulseY}
                    r={pulseRadius}
                    color="white"
                    style="stroke"
                    strokeWidth={45}
                    opacity={pulseOpacity}
                  />

                  {/* Player constant localized flashlight bubble */}
                  <Circle
                    cx={playerX}
                    cy={playerY}
                    r={32}
                    color="white"
                    opacity={0.3}
                  />
                </Group>
              }
            >
              {/* 2. Masked Geometry - Only visible when intersected by Sonar Circle/Flashlight */}
              <Group>
                {/* Emerald Green Digital Walls */}
                {level.obstacles.map((obs) => (
                  <Rect
                    key={obs.id}
                    x={obs.x}
                    y={obs.y}
                    width={obs.width}
                    height={obs.height}
                    color="rgb(34, 197, 94)"
                  />
                ))}

                {/* Exit Portal - Purple Swirl */}
                <Circle
                  cx={level.exitPortal.x}
                  cy={level.exitPortal.y}
                  r={level.exitPortal.radius}
                  color="rgb(168, 85, 247)"
                />
              </Group>
            </Mask>

            {/* 3. Non-Masked UI Overlays (Visible at all times) */}
            {/* White/Cyan beacon dot for player character */}
            <Circle
              cx={playerX}
              cy={playerY}
              r={7}
              color="rgb(34, 211, 238)"
            />
          </Canvas>

          {/* HUD HUD overlay */}
          <View style={styles.hudContainer} pointerEvents="none">
            <Text style={styles.hudText}>LEVEL: {level.id}</Text>
            <Text style={styles.hudTextSub}>ENERGY: {Math.round(energy * 100)}%</Text>
          </View>

          {/* Overlay Screens */}
          {levelStatus === 'WON' && (
            <View style={styles.overlay}>
              <Text style={styles.titleText}>CHAMBER ESCAPED</Text>
              <Text style={styles.subtext}>Acoustic tunnel clear. Ready to jump.</Text>
              <TouchableOpacity style={styles.button} onPress={nextChamber}>
                <Text style={styles.buttonText}>NEXT CHAMBER</Text>
              </TouchableOpacity>
            </View>
          )}

          {levelStatus === 'GAMEOVER' && (
            <View style={styles.overlay}>
              <Text style={[styles.titleText, { color: '#ef4444' }]}>SYSTEM SHUTDOWN</Text>
              <Text style={styles.subtext}>You collided with walls too many times in the silence.</Text>
              <TouchableOpacity style={[styles.button, { backgroundColor: '#ef4444' }]} onPress={restartRoom}>
                <Text style={styles.buttonText}>RE-ENTER</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gameArea: {
    flex: 1,
  },
  hudContainer: {
    position: 'absolute',
    top: 60,
    left: 24,
  },
  hudText: {
    color: '#22d3ee',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  hudTextSub: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  titleText: {
    color: '#22d3ee',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtext: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 1.5,
    fontSize: 12,
  },
});`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(nativeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f12] border border-[#1e293b] rounded-xl overflow-hidden font-sans">
      {/* Code Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-[#14181f] border-b border-[#1e293b]">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-cyan-950/50 border border-cyan-800/40 rounded-lg text-cyan-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 tracking-wide">ReactNativeSkiaGame.tsx</h3>
            <p className="text-[11px] text-slate-400">Production-ready React Native Expo code with Skia Canvas & Reanimated</p>
          </div>
        </div>
        
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-2 px-3.5 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/50 hover:border-cyan-700/60 rounded-lg text-xs font-medium text-cyan-400 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 animate-scale-up" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Tech Specifications */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-[#11141a] border-b border-[#1e293b] text-[11px] text-slate-400 font-mono">
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#0d0f12] rounded-md border border-slate-800/40">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Skia canvas rendering (60 FPS)</span>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#0d0f12] rounded-md border border-slate-800/40">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Reanimated v3 UI reactions</span>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#0d0f12] rounded-md border border-slate-800/40">
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span>Expo-Haptics integrations</span>
        </div>
      </div>

      {/* Code Textarea / Block */}
      <div className="flex-1 overflow-auto p-4 text-xs font-mono text-slate-300 bg-[#08090d] leading-relaxed selection:bg-cyan-500/20">
        <pre className="whitespace-pre overflow-x-auto select-text">
          <code>{nativeCode}</code>
        </pre>
      </div>
    </div>
  );
}
