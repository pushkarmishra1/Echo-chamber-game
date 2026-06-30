import { useState, useEffect } from 'react';
import { generateRandomLevel } from './utils/generator';
import GameCanvas from './components/GameCanvas';
import { GameStatus } from './types';
import { 
  Play, 
  Settings, 
  RotateCcw, 
  ArrowRight, 
  ArrowLeft,
  ChevronDown,
  Ghost,
  ShieldAlert,
  Volume2,
  VolumeX,
  Sparkles,
  Award,
  Info,
  RefreshCw,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { startAmbientDrone, stopAmbientDrone, setBGMVolume, setSFXVolume, initAudio } from './utils/audio';
import Leaderboard from './components/Leaderboard';

export default function App() {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [finalTimeTaken, setFinalTimeTaken] = useState<number>(0);

  const [currentLevelNum, setCurrentLevelNum] = useState<number>(() => {
    const saved = localStorage.getItem('echochamber_level');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [highestCompletedLevel, setHighestCompletedLevel] = useState<number>(() => {
    const saved = localStorage.getItem('echochamber_highest_level');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [currentLevel, setCurrentLevel] = useState(() => generateRandomLevel(currentLevelNum));
  const [gameStatus, setGameStatus] = useState<GameStatus>('WELCOME');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('echochamber_muted');
    return saved === 'true';
  });
  const [bgmVolume, setBgmVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('echochamber_bgm_volume');
    return saved ? parseFloat(saved) : 0.15;
  });
  const [sfxVolume, setSfxVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('echochamber_sfx_volume');
    return saved ? parseFloat(saved) : 0.7;
  });
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('echochamber_vibration');
    return saved !== 'false';
  });
  const [playerShape, setPlayerShape] = useState<'circle' | 'triangle' | 'square'>(() => {
    const saved = localStorage.getItem('echochamber_player_shape');
    return (saved as 'circle' | 'triangle' | 'square') || 'circle';
  });
  const [keyOffset, setKeyOffset] = useState(0); // Forces canvas component re-mount
  const [pulsesUsed, setPulsesUsed] = useState(0);
  const [sanity, setSanity] = useState(3);
  const [flares, setFlares] = useState<number>(3);
  const [flareActive, setFlareActive] = useState<boolean>(false);

  const handleUseFlare = () => {
    if (flares > 0 && !flareActive && gameStatus === 'PLAYING') {
      setFlares((prev) => prev - 1);
      setFlareActive(true);
      setTimeout(() => {
        setFlareActive(false);
      }, 3500); // 3.5 seconds
    }
  };

  // Sync current level to localStorage
  useEffect(() => {
    localStorage.setItem('echochamber_level', String(currentLevelNum));
    setCurrentLevel(generateRandomLevel(currentLevelNum));
  }, [currentLevelNum]);

  // Sync highest level completed to localStorage
  useEffect(() => {
    localStorage.setItem('echochamber_highest_level', String(highestCompletedLevel));
  }, [highestCompletedLevel]);

  // Sync vibration state to localStorage
  useEffect(() => {
    localStorage.setItem('echochamber_vibration', String(vibrationEnabled));
  }, [vibrationEnabled]);

  // Sync player shape state to localStorage
  useEffect(() => {
    localStorage.setItem('echochamber_player_shape', playerShape);
  }, [playerShape]);

  // Sync audio mute to localStorage and ambient sound drone
  useEffect(() => {
    localStorage.setItem('echochamber_muted', String(isMuted));
    if (gameStatus === 'PLAYING' && !isMuted) {
      startAmbientDrone();
    } else {
      stopAmbientDrone();
    }
  }, [isMuted, gameStatus]);

  // Sync volume values to audio processor
  useEffect(() => {
    setBGMVolume(bgmVolume);
    localStorage.setItem('echochamber_bgm_volume', String(bgmVolume));
  }, [bgmVolume]);

  useEffect(() => {
    setSFXVolume(sfxVolume);
    localStorage.setItem('echochamber_sfx_volume', String(sfxVolume));
  }, [sfxVolume]);

  // Handle Level Victory
  const handleLevelComplete = () => {
    setHighestCompletedLevel((prev) => Math.max(prev, currentLevelNum + 1));
    setGameStatus('WON');
    if (gameStartTime) {
      const elapsed = Math.round((Date.now() - gameStartTime) / 1000);
      setFinalTimeTaken(Math.max(1, elapsed));
    } else {
      setFinalTimeTaken(15);
    }
  };

  // Handle Game Over
  const handleGameOver = () => {
    setGameStatus('GAMEOVER');
  };

  // Proceed to next procedural chamber
  const handleNextLevel = () => {
    const nextLvl = currentLevelNum + 1;
    setCurrentLevelNum(nextLvl);
    setPulsesUsed(0);
    setSanity(3);
    setFlares(3);
    setFlareActive(false);
    setGameStatus('PLAYING');
    setGameStartTime(Date.now());
    setKeyOffset((prev) => prev + 1);
  };

  // Retry the current procedural chamber
  const handleRestartLevel = () => {
    setPulsesUsed(0);
    setSanity(3);
    setFlares(3);
    setFlareActive(false);
    setGameStatus('PLAYING');
    setGameStartTime(Date.now());
    setKeyOffset((prev) => prev + 1);
  };

  // Completely wipe local storage and reset to level 1
  const handleResetProgress = () => {
    localStorage.removeItem('echochamber_level');
    localStorage.removeItem('echochamber_highest_level');
    setHighestCompletedLevel(1);
    setCurrentLevelNum(1);
    setPulsesUsed(0);
    setSanity(3);
    setFlares(3);
    setFlareActive(false);
    setGameStatus('WELCOME');
    setKeyOffset((prev) => prev + 1);
  };

  return (
    <>
      {/* Portrait Orientation Warning Screen Overlay */}
      <div className="portrait-show fixed inset-0 z-[9999] bg-[#020204] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-5 animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-cyan-950/30 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <div className="space-y-2">
            <h3 className="font-mono text-xs font-bold tracking-[0.2em] text-cyan-400 uppercase">
              Orientation Lock
            </h3>
            <p className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Please rotate your phone to play.
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              Landscape mode is required for full spatial navigation.
            </p>
          </div>
        </div>
      </div>

      <div className="portrait-hide w-screen h-screen max-h-screen bg-[#020204] text-slate-100 flex flex-col font-sans select-none overflow-hidden relative">
      {/* Immersive Dark Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full bg-[#030307] pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-950/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-950/10 rounded-full blur-[140px]" />
      </div>

      <div className="flex-1 flex flex-col z-10 relative overflow-hidden h-full max-h-full">
        <AnimatePresence mode="wait">
          
          {/* WELCOME STATE */}
          {gameStatus === 'WELCOME' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
              style={{ height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              className="relative z-10"
            >
              <div 
                style={{ 
                  maxHeight: '95vh', 
                  overflowY: 'auto', 
                  width: '100%', 
                  maxWidth: '800px', 
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'center'
                }}
                className="space-y-4 sm:space-y-5 bg-black/40 border border-slate-900/80 backdrop-blur-md rounded-3xl shadow-2xl relative scrollbar-thin scrollbar-thumb-cyan-950 scrollbar-track-transparent"
              >
                <div className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-cyan-500/60 rounded-tl pointer-events-none" />
                <div className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-cyan-500/60 rounded-tr pointer-events-none" />
                <div className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-cyan-500/60 rounded-bl pointer-events-none" />
                <div className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-cyan-500/60 rounded-br pointer-events-none" />

                {/* Subtitle / System Tag */}
                <div className="flex items-center justify-center space-x-1.5 text-cyan-500 font-mono text-[8px] sm:text-[9px] tracking-[0.1em] sm:tracking-[0.2em] uppercase font-bold animate-pulse text-center w-full mt-2">
                  <Ghost className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                  <span>Sightless Spatial Navigation Terminal</span>
                </div>

                {/* Title */}
                <div className="space-y-1 text-center w-full">
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-[0.1em] sm:tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-slate-100 to-purple-400 uppercase select-none drop-shadow-[0_0_15px_rgba(6,182,212,0.15)] leading-tight">
                    ECHOCHAMBER
                  </h1>
                  <p className="text-[9px] sm:text-xs text-slate-400 font-mono tracking-wider">
                    RESONANCE PROPAGATION ENGINE &bull; CHAMBER {currentLevelNum}
                  </p>
                </div>

                {/* Atmospheric Description */}
                <p className="text-[10px] sm:text-xs md:text-sm text-slate-300 leading-relaxed max-w-lg mx-auto font-sans text-center">
                  You are suspended in a pitch-black labyrinth. Dispatch expanding <strong className="text-cyan-400">sonar pulses</strong> to briefly map columns, dividers, and moving hazards. Move carefully towards the rotating escape vortex before your cognitive sanity is depleted.
                </p>

                {/* Operational Guidelines Block */}
                <div className="bg-[#040812]/90 border border-cyan-950/40 rounded-2xl p-3 sm:p-4 text-left space-y-2 w-full">
                  <h3 className="text-[9px] sm:text-[10px] font-bold tracking-wider text-cyan-400 uppercase font-mono flex items-center gap-1.5">
                    <Info className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    SYSTEM INTERACTION MANUAL
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-[9px] sm:text-[10px] leading-snug text-slate-400 font-sans">
                    <div className="space-y-0.5">
                      <span className="text-cyan-400 font-semibold font-mono block">📡 ACOUSTIC SONAR</span>
                      <span>Click inside the black viewport to send a radar ring. Scanned structures glow green; dynamic hazards flash red.</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-purple-400 font-semibold font-mono block">🌀 ESCAPE VORTEX</span>
                      <span>Locate and reach the purple neon portal. Sound waves will illuminate its position on direct contact.</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-red-400 font-semibold font-mono block">💥 STRUCTURAL IMPACT</span>
                      <span>Crashing into hidden obstacles reduces sanity by 20%. Avoid hazardous red moving walls.</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-amber-500 font-semibold font-mono block">🎧 SPATIAL HEADPHONES</span>
                      <span>Audio echo frequencies simulate left/right distance. Recommended for absolute spatial immersion.</span>
                    </div>
                  </div>
                </div>

                {/* Primary CTA */}
                <div className="pt-2 text-center w-full space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        setGameStatus('READY');
                        // Bind HTML5 Fullscreen API
                        try {
                          if (document.documentElement.requestFullscreen) {
                            document.documentElement.requestFullscreen().catch(() => {});
                          }
                        } catch (_) {}
                        // Bind Screen Orientation API
                        try {
                          const orient = screen.orientation as any;
                          if (orient && typeof orient.lock === 'function') {
                            orient.lock('landscape').catch(() => {});
                          }
                        } catch (_) {}
                      }}
                      className="group relative inline-flex items-center justify-center space-x-2 px-5 py-2 sm:px-6 sm:py-3 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800 hover:border-cyan-500 text-cyan-400 hover:text-cyan-300 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-lg hover:shadow-cyan-950/60 transform hover:-translate-y-0.5 cursor-pointer w-full sm:w-auto"
                    >
                      <div className="absolute inset-0 w-full h-full rounded-xl bg-cyan-400/5 blur opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Play className="w-3.5 h-3.5 fill-cyan-400" />
                      <span>INITIALIZE EMITTER</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsSettingsOpen(true);
                      }}
                      className="inline-flex items-center justify-center space-x-2 px-5 py-2 sm:px-6 sm:py-3 bg-slate-950/60 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-lg cursor-pointer w-full sm:w-auto"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>SETTINGS</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsLeaderboardOpen(true);
                      }}
                      className="inline-flex items-center justify-center space-x-2 px-5 py-2 sm:px-6 sm:py-3 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-900 hover:border-purple-600 text-purple-300 hover:text-purple-200 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-lg cursor-pointer w-full sm:w-auto"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>LEADERBOARD</span>
                    </button>
                  </div>
                  <p className="text-[8px] text-slate-500 font-mono">PROCEED AT YOUR OWN RISK</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* READY STATE */}
          {gameStatus === 'READY' && (
            <motion.div 
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                initAudio();
                setGameStatus('PLAYING');
                setGameStartTime(Date.now());
              }}
              className="w-screen h-screen bg-[#020204] flex flex-col justify-center items-center cursor-pointer select-none relative z-10"
            >
              <div className="text-center space-y-4">
                <motion.div 
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  className="text-cyan-400 font-mono text-base tracking-[0.25em] font-bold uppercase select-none"
                >
                  📡 TAP ANYWHERE TO BEGIN
                </motion.div>
                <div className="text-slate-600 font-mono text-[9px] tracking-widest uppercase">
                  RESONANCE RECEIVER IS ARMED
                </div>
              </div>
            </motion.div>
          )}

          {/* PLAYING STATE */}
          {gameStatus === 'PLAYING' && (
            <motion.div 
              key="playing-viewport"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-full max-h-full relative overflow-hidden"
            >
              {/* Minimalist Compact 40px HUD Header */}
              <div className="h-10 border-b border-slate-900/40 bg-black/40 backdrop-blur px-3 flex items-center justify-between z-20 flex-shrink-0 select-none text-xs font-mono">
                {/* Left: Back button */}
                <button
                  onClick={() => {
                    setGameStatus('WELCOME');
                    setPulsesUsed(0);
                    setSanity(3);
                  }}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-slate-950/80 hover:bg-slate-900 border border-slate-900 hover:border-cyan-800/60 text-slate-400 hover:text-cyan-400 rounded-lg text-[10px] font-semibold transition-all duration-200 cursor-pointer shadow"
                  title="Return to Welcome Terminal"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                {/* Middle: Chamber, Pulses and Sanity compact readouts */}
                <div className="flex items-center space-x-3 sm:space-x-5 overflow-hidden text-[10px] sm:text-xs">
                  <span className="text-slate-200 font-bold tracking-widest uppercase">
                    CHAMBER: {currentLevelNum < 10 ? `0${currentLevelNum}` : currentLevelNum}
                  </span>
                  <span className="text-slate-800">|</span>
                  <span className="text-cyan-400 font-bold tracking-widest uppercase">
                    PULSES: {pulsesUsed}
                  </span>
                  <span className="text-slate-800">|</span>
                  <span className={`font-bold tracking-widest uppercase ${sanity <= 1 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                    SANITY: {sanity}/3
                  </span>
                </div>

                {/* Right: Sound Controls & Settings Icon */}
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button
                    onClick={() => setIsMuted(prev => !prev)}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      isMuted 
                        ? 'bg-black/60 text-slate-500 border-slate-900' 
                        : 'bg-cyan-950/20 text-cyan-400 border-cyan-950/50'
                    }`}
                    title={isMuted ? "Unmute atmospheric drone" : "Mute audio"}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-1.5 rounded-lg border bg-slate-950/80 hover:bg-cyan-950/20 text-slate-400 hover:text-cyan-400 border-slate-900 hover:border-cyan-900/50 transition-all duration-200 cursor-pointer shadow-sm"
                    title="System Parameters"
                  >
                    <Settings className="w-3.5 h-3.5 animate-[spin_8s_linear_infinite]" />
                  </button>
                </div>
              </div>

              {/* Pure Viewport Canvas Frame */}
              <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden w-full items-center justify-center">
                <GameCanvas
                  level={currentLevel}
                  isPaused={isSettingsOpen}
                  isMuted={isMuted}
                  onLevelComplete={handleLevelComplete}
                  onGameOver={handleGameOver}
                  onReset={handleRestartLevel}
                  onPulsesUpdated={setPulsesUsed}
                  onSanityUpdated={setSanity}
                  flares={flares}
                  setFlares={setFlares}
                  flareActive={flareActive}
                  setFlareActive={setFlareActive}
                  vibrationEnabled={vibrationEnabled}
                  playerShape={playerShape}
                  key={`canvas-${currentLevelNum}-${keyOffset}`}
                />
              </div>

            </motion.div>
          )}

          {/* LEVEL WON STATE */}
          {gameStatus === 'WON' && (
            <motion.div 
              key="won"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-[100dvh] w-full flex items-center justify-center overflow-y-auto p-4 text-center max-w-xl mx-auto scrollbar-thin scrollbar-thumb-cyan-950 scrollbar-track-transparent"
            >
              <div className="my-auto space-y-6 bg-[#04020a] border border-purple-950/40 backdrop-blur rounded-3xl p-5 sm:p-10 shadow-2xl relative w-full">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-purple-500/60 rounded-tl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-purple-500/60 rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-purple-500/60 rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-purple-500/60 rounded-br" />

                <div className="p-3 sm:p-4 bg-purple-950/40 border border-purple-800/40 rounded-full w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mx-auto text-purple-400 shadow-xl shadow-purple-950/20">
                  <Award className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-2xl font-bold tracking-widest text-purple-400 uppercase font-mono break-words whitespace-normal text-wrap">
                    CHAMBER ESCAPED
                  </h2>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono uppercase tracking-widest break-words whitespace-normal text-wrap">
                    ESCAPE PORTAL LOCK ALIGNED &bull; SYSTEM UNLOCKED
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto break-words whitespace-normal text-wrap">
                  You successfully navigated the acoustic landscape of <strong className="text-slate-200">"{currentLevel.name}"</strong> and entered the rotating vortex warp hole.
                </p>

                {/* Score stats block */}
                <div className="grid grid-cols-3 gap-4 bg-[#0a0515]/60 border border-purple-950/20 p-4 rounded-xl text-center font-mono text-[10px] sm:text-[11px] text-slate-400">
                  <div>
                    <span className="block text-slate-500 text-[8px] sm:text-[9px] uppercase tracking-wider break-words whitespace-normal text-wrap">RESONATORS FIRED</span>
                    <strong className="text-xs sm:text-sm text-purple-400 font-bold">{pulsesUsed} pulses</strong>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[8px] sm:text-[9px] uppercase tracking-wider break-words whitespace-normal text-wrap">TIME ELAPSED</span>
                    <strong className="text-xs sm:text-sm text-purple-400 font-bold">{finalTimeTaken} seconds</strong>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[8px] sm:text-[9px] uppercase tracking-wider break-words whitespace-normal text-wrap">COGNITIVE INTEGRITY</span>
                    <strong className="text-xs sm:text-sm text-purple-400 font-bold">{sanity}/3 lives</strong>
                  </div>
                </div>

                {/* Live Fullstack Leaderboard & Score Submission Form */}
                <div className="text-left">
                  <Leaderboard onlyView={false} timeTaken={finalTimeTaken} sanityRemaining={sanity} />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => {
                      setPulsesUsed(0);
                      setSanity(3);
                      setGameStatus('WELCOME');
                    }}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 px-5 py-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-900/80 text-slate-400 hover:text-slate-200 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                  >
                    <span>Exit to Main Menu</span>
                  </button>

                  <button
                    onClick={handleRestartLevel}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 px-5 py-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-slate-300 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Re-map Room</span>
                  </button>

                  <button
                    onClick={handleNextLevel}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 px-6 py-3.5 bg-purple-950 hover:bg-purple-900 border border-purple-800 hover:border-purple-600 text-purple-300 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-lg hover:shadow-purple-950/50 cursor-pointer"
                  >
                    <span>Next Chamber</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* GAMEOVER STATE */}
          {gameStatus === 'GAMEOVER' && (
            <motion.div 
              key="gameover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-[100dvh] w-full flex items-center justify-center overflow-y-auto p-4 text-center max-w-xl mx-auto scrollbar-thin scrollbar-thumb-cyan-950 scrollbar-track-transparent"
            >
              <div className="my-auto space-y-6 bg-[#0a0204] border border-red-950/40 backdrop-blur rounded-3xl p-5 sm:p-10 shadow-2xl relative w-full">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-red-500/60 rounded-tl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-red-500/60 rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-red-500/60 rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-red-500/60 rounded-br" />

                <div className="p-3 sm:p-4 bg-red-950/40 border border-red-850/40 rounded-full w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mx-auto text-red-400 shadow-xl shadow-red-950/20">
                  <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 animate-bounce" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-2xl font-bold tracking-widest text-red-500 uppercase font-mono break-words whitespace-normal text-wrap">
                    lost in the darkness
                  </h2>
                  <p className="text-[9px] sm:text-[10px] text-red-600/80 font-mono uppercase tracking-widest break-words whitespace-normal text-wrap">
                    cognitive sanity depleted &bull; signal termination
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto break-words whitespace-normal text-wrap">
                  You collided with hidden architectural pillars too many times. Your sonar frequency was scrambled, and the entities lurking inside the EchoChamber detected your panic.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => {
                      setPulsesUsed(0);
                      setSanity(3);
                      setGameStatus('WELCOME');
                    }}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 px-5 py-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-900/80 text-slate-400 hover:text-slate-200 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                  >
                    <span>Exit to Main Menu</span>
                  </button>

                  <button
                    onClick={handleRestartLevel}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 px-6 py-3.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900 hover:border-red-500 text-red-300 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-lg hover:shadow-red-950/40 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Try Again / Restart Simulation</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Global Floating Settings Overlay Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div 
              key="settings-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#010103]/85 backdrop-blur-[5px] flex items-center justify-center p-4 sm:p-6 z-30"
            >
              <motion.div
                initial={{ y: 30, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 30, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="max-w-md w-full bg-[#04060c]/95 border border-slate-900/90 rounded-3xl p-6 sm:p-7 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden"
              >
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-500/60 rounded-tl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-500/60 rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-500/60 rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-500/60 rounded-br" />

                {/* Settings Header */}
                <div className="flex items-center space-x-3 pb-3 border-b border-slate-900/60 flex-shrink-0">
                  <div className="p-2 bg-cyan-950/40 border border-cyan-900/30 rounded-xl text-cyan-400">
                    <Settings className="w-5 h-5 animate-[spin_6s_linear_infinite]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-widest text-slate-100 uppercase font-mono">SYSTEM PARAMETERS</h2>
                    <p className="text-[9px] text-slate-400 uppercase font-mono">Emitter Configuration Panel</p>
                  </div>
                </div>

                {/* Scrollable Container for Settings Content */}
                <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-5 scrollbar-thin scrollbar-thumb-cyan-950 scrollbar-track-transparent">
                  
                  {/* Gameplay Guide Protocol */}
                  <div className="space-y-1.5">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 font-mono">Acoustic Guide</h3>
                    <div className="text-[10px] text-slate-400 leading-relaxed bg-black/40 border border-slate-900/50 p-3 rounded-xl space-y-1">
                      <p>• Click the grid viewport to issue a sonar wave. The wave expands outwards, lighting up structures briefly on contact.</p>
                      <p>• Red walls move dynamically and represent high-frequency hazards. Green walls are static architectural obstructions.</p>
                      <p>• Your physical position moves directly towards the clicked coordinates. If you hit an obstacle, sanity is severely reduced.</p>
                    </div>
                  </div>

                  {/* Level / Chamber Selector Section */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 font-mono">Chamber Selector</h3>
                      <span className="text-[9px] text-slate-500 font-mono font-bold px-1.5 py-0.5 bg-black/40 border border-slate-900 rounded-md">LEVELS 1 - 100</span>
                    </div>

                    {/* Dropdown with full level names */}
                    <div className="relative">
                      <select
                        value={currentLevelNum}
                        onChange={(e) => {
                          const lvl = parseInt(e.target.value, 10);
                          setCurrentLevelNum(lvl);
                          setPulsesUsed(0);
                          setSanity(3);
                          setKeyOffset((prev) => prev + 1);
                          setGameStatus('PLAYING');
                          setIsSettingsOpen(false);
                        }}
                        className="w-full bg-black/60 border border-slate-900 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                      >
                        {Array.from({ length: 100 }, (_, i) => i + 1).map((lvl) => {
                          const isCurrent = lvl === currentLevelNum;
                          const isCompleted = lvl < highestCompletedLevel;
                          const isLocked = lvl > highestCompletedLevel;
                          return (
                            <option key={lvl} value={lvl} disabled={isLocked} className="bg-[#04060c] text-[#cbd5e1] disabled:text-slate-600">
                              Chamber {lvl < 10 ? `0${lvl}` : lvl} {isCompleted ? '✓' : ''} - {generateRandomLevel(lvl).name} {isCurrent ? '(Active)' : ''} {isLocked ? '(Locked)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Interactive Scrollable Grid of Numbers */}
                    <div className="space-y-1">
                      <span className="text-[8px] text-slate-500 font-mono uppercase block">Chamber Directory (Click to jump)</span>
                      <div className="h-28 overflow-y-auto pr-1 bg-black/40 border border-slate-950 p-2 rounded-xl scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent">
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                          {Array.from({ length: 100 }, (_, i) => i + 1).map((lvl) => {
                            const isCurrent = lvl === currentLevelNum;
                            const isCompleted = lvl < highestCompletedLevel;
                            const isLocked = lvl > highestCompletedLevel;
                            return (
                              <button
                                key={lvl}
                                disabled={isLocked}
                                onClick={() => {
                                  if (isLocked) return;
                                  setCurrentLevelNum(lvl);
                                  setPulsesUsed(0);
                                  setSanity(3);
                                  setKeyOffset((prev) => prev + 1);
                                  setGameStatus('PLAYING');
                                  setIsSettingsOpen(false);
                                }}
                                className={`h-7 rounded-lg text-[10px] font-bold font-mono transition-all duration-150 flex items-center justify-center ${
                                  isCurrent
                                    ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.6)] border-2 border-cyan-300 scale-105 z-10 font-extrabold cursor-pointer'
                                    : isLocked
                                      ? 'bg-slate-950/20 text-slate-700 border border-slate-950/30 cursor-not-allowed opacity-40'
                                      : isCompleted
                                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-900/30 cursor-pointer'
                                        : 'bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-900 hover:border-slate-800 cursor-pointer'
                                }`}
                                title={isLocked ? `Chamber ${lvl} (Locked)` : `Jump to Chamber ${lvl}${isCompleted ? ' (Completed)' : ''}`}
                              >
                                <span className="flex items-center justify-center gap-0.5">
                                  <span>{lvl}</span>
                                  {isCompleted && (
                                    <span className={isCurrent ? "text-slate-900 text-[9px] font-sans font-bold" : "text-emerald-400 text-[9px] font-sans font-bold"}>
                                      ✓
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audio Interface (Volume Control Sliders) */}
                  <div className="space-y-2.5">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 font-mono">Audio Interface Channels</h3>
                    <div className="space-y-3 bg-black/30 border border-slate-900/60 p-4 rounded-xl">
                      {/* Ambient BGM Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.8)] animate-pulse" />
                            AMBIENT BGM
                          </span>
                          <span className="text-purple-400 font-bold">{Math.round(bgmVolume * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.05"
                          value={bgmVolume}
                          onChange={(e) => setBgmVolumeState(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-950 border border-slate-900/80 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                        />
                      </div>

                      {/* SFX & Movement Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)] animate-pulse" />
                            SFX & MOVEMENT
                          </span>
                          <span className="text-cyan-400 font-bold">{Math.round(sfxVolume * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.05"
                          value={sfxVolume}
                          onChange={(e) => setSfxVolumeState(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-950 border border-slate-900/80 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Audio Controls */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 font-mono">Audio Settings</h3>
                    <div className="flex items-center justify-between p-3 bg-black/30 border border-slate-900/60 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-200">Acoustic Synthesizer</span>
                        <span className="text-[9px] text-slate-500">Procedural background soundscapes</span>
                      </div>
                      <button
                        onClick={() => setIsMuted(prev => !prev)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all cursor-pointer ${
                          isMuted 
                            ? 'bg-[#12070c] hover:bg-[#1f0b14] text-red-400 border-red-950/60' 
                            : 'bg-cyan-950/20 hover:bg-cyan-900/20 text-cyan-400 border-cyan-900/40'
                        }`}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        <span>{isMuted ? 'Muted' : 'On'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Vessel Geometry / Shape Selection */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 font-mono">Vessel Geometry</h3>
                    <div className="p-3 bg-black/30 border border-slate-900/60 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-200 font-sans">Active Avatar Profile</span>
                        <span className="text-[9px] text-slate-500 font-mono uppercase font-bold px-1.5 py-0.5 bg-black/40 border border-slate-900 rounded-md">
                          {playerShape}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['circle', 'triangle', 'square'] as const).map((shape) => (
                          <button
                            key={shape}
                            onClick={() => setPlayerShape(shape)}
                            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border font-mono cursor-pointer ${
                              playerShape === shape
                                ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(6,182,212,0.4)] border-cyan-300'
                                : 'bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-900 hover:border-slate-800'
                            }`}
                          >
                            {shape}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Haptic Interface */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 font-mono">Haptic Interface</h3>
                    <div className="flex items-center justify-between p-3 bg-black/30 border border-slate-900/60 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-200">Device Vibration</span>
                        <span className="text-[9px] text-slate-500">Tactile impact and sonar echo feedback</span>
                      </div>
                      <button
                        onClick={() => setVibrationEnabled(prev => !prev)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all cursor-pointer ${
                          vibrationEnabled 
                            ? 'bg-cyan-950/20 hover:bg-cyan-900/20 text-cyan-400 border-cyan-900/40'
                            : 'bg-[#12070c] hover:bg-[#1f0b14] text-red-400 border-red-950/60'
                        }`}
                      >
                        <span>{vibrationEnabled ? 'Enabled' : 'Disabled'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Progress Utilities */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 font-mono">Progress Vector</h3>
                    <div className="flex items-center justify-between p-3 bg-black/30 border border-slate-900/60 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-200">Wipe Saved Levels</span>
                        <span className="text-[9px] text-slate-500">Reset records back to Chamber 1</span>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm("Reset progressive navigation records? This cannot be undone.")) {
                            handleResetProgress();
                          }
                        }}
                        className="px-3 py-1.5 bg-red-950/10 hover:bg-red-950/30 border border-red-950 hover:border-red-500/40 text-red-400 rounded-lg text-xs font-bold uppercase tracking-wide transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 inline mr-1 align-middle" />
                        Reset Progress
                      </button>
                    </div>
                  </div>
                </div>

                {/* Primary Navigation Actions Footer */}
                <div className="border-t border-slate-900/60 pt-4 space-y-3 flex-shrink-0">
                  {gameStatus === 'WELCOME' || gameStatus === 'READY' ? (
                    <button
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-full flex items-center justify-center space-x-2 px-5 py-3.5 bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-800 hover:border-cyan-500 text-cyan-400 hover:text-cyan-300 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-lg transform hover:-translate-y-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>BACK TO TERMINAL</span>
                    </button>
                  ) : (
                    <>
                      {/* Resume Button */}
                      <button
                        onClick={() => setIsSettingsOpen(false)}
                        className="w-full flex items-center justify-center space-x-2 px-5 py-3.5 bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-800 hover:border-cyan-500 text-cyan-400 hover:text-cyan-300 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-lg transform hover:-translate-y-0.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-cyan-400" />
                        <span>RESUME SIMULATION</span>
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Restart Chamber */}
                        <button
                          onClick={() => {
                            handleRestartLevel();
                            setIsSettingsOpen(false);
                          }}
                          className="flex items-center justify-center space-x-1.5 px-4 py-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restart Room</span>
                        </button>

                        {/* Exit Game */}
                        <button
                          onClick={() => {
                            setPulsesUsed(0);
                            setSanity(3);
                            setIsSettingsOpen(false);
                            setGameStatus('WELCOME');
                          }}
                          className="flex items-center justify-center space-x-1.5 px-4 py-3 bg-red-950/10 hover:bg-red-950/30 border border-red-950/60 hover:border-red-800/80 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                        >
                          <span>Exit Game</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Developer Support Tag */}
                  <div className="pt-2 border-t border-slate-950 flex justify-between items-center text-[9px] text-slate-500 font-mono">
                    <span>Emitter Terminal v3.5</span>
                    <span>Developer: <span className="text-slate-300 font-bold font-sans">Pushkar</span></span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Global Leaderboard Overlay Modal */}
          {isLeaderboardOpen && (
            <motion.div 
              key="leaderboard-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#010103]/85 backdrop-blur-[5px] flex items-center justify-center p-4 sm:p-6 z-30"
            >
              <div className="max-w-md w-full relative">
                <Leaderboard 
                  onlyView={true} 
                  onClose={() => setIsLeaderboardOpen(false)} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </>
  );
}
