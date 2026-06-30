// Procedural audio synthesizer for EchoChamber using Web Audio API

let audioCtx: AudioContext | null = null;

let sfxVolume = 0.7;
let bgmVolume = 0.15;

export function getSFXVolume() {
  return sfxVolume;
}

export function getBGMVolume() {
  return bgmVolume;
}

export function setSFXVolume(vol: number) {
  sfxVolume = vol;
}

export function setBGMVolume(vol: number) {
  bgmVolume = vol;
  if (ambientDrone) {
    const ctx = getAudioContext();
    if (ctx) {
      ambientDrone.gain.gain.setValueAtTime(vol, ctx.currentTime);
    }
  }
}

export function initAudio() {
  getAudioContext();
}

function getAudioContext() {
  if (!audioCtx) {
    // Standard AudioContext initialization
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a high-quality sonar pulse sound effect (high sweep-down frequency)
 */
export function playSonarPing(xRatio: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  // Pan based on tap coordinate (xRatio from 0.0 left to 1.0 right)
  const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (panNode) {
    panNode.pan.value = (xRatio - 0.5) * 2; // scale to [-1, 1]
    gainNode.disconnect(ctx.destination);
    gainNode.connect(panNode);
    panNode.connect(ctx.destination);
  }

  // Sonar sound shape
  osc.type = 'sine';
  const startFreq = 900 + (1 - xRatio) * 300; // slightly modulate pitch based on position
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  // Sweep frequency down quickly
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 1.2);

  // Exp decay gain envelope
  gainNode.gain.setValueAtTime(0.6 * sfxVolume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.2);
}

/**
 * Plays a short echo reflection ping when wave hits a wall
 */
export function playEchoReflection(distanceRatio: number, xRatio: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  if (ctx.createStereoPanner) {
    const panNode = ctx.createStereoPanner();
    panNode.pan.value = (xRatio - 0.5) * 2;
    gainNode.disconnect(ctx.destination);
    gainNode.connect(panNode);
    panNode.connect(ctx.destination);
  }

  osc.type = 'sine';
  // Pitch is higher for closer obstacles, lower for far ones
  const pitch = 600 - (distanceRatio * 300);
  osc.frequency.setValueAtTime(pitch, ctx.currentTime);

  // Short clicky tap with decay
  gainNode.gain.setValueAtTime(0.08 * sfxVolume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.16);
}

/**
 * Plays a heavy, distorted alarm/impact sound when player bumps into a wall
 */
export function playWallThud() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const noise = ctx.createOscillator(); // Or low pitch saw
  const gainNode = ctx.createGain();

  osc.connect(gainNode);
  noise.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.3);

  noise.type = 'triangle';
  noise.frequency.setValueAtTime(90, ctx.currentTime);

  gainNode.gain.setValueAtTime(0.6 * sfxVolume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

  osc.start(ctx.currentTime);
  noise.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);
  noise.stop(ctx.currentTime + 0.4);
}

/**
 * Plays a beautiful pentatonic synth sweep on clearing a level
 */
export function playLevelWin() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major Pentatonic
  const time = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time + idx * 0.12);

    // Fade in and fade out
    gainNode.gain.setValueAtTime(0, time + idx * 0.12);
    gainNode.gain.linearRampToValueAtTime(0.15 * sfxVolume, time + idx * 0.12 + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.12 + 0.6);

    osc.start(time + idx * 0.12);
    osc.stop(time + idx * 0.12 + 0.7);
  });
}

/**
 * Plays a haunting wind/drone sound in the background for atmospheric effect
 */
let ambientDrone: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null;

export function startAmbientDrone() {
  const ctx = getAudioContext();
  if (!ctx || ambientDrone) return;

  try {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, ctx.currentTime); // A1 low frequency
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(55.5, ctx.currentTime); // slightly detuned for chorus beating

    gainNode.gain.setValueAtTime(bgmVolume, ctx.currentTime);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start();
    osc2.start();

    ambientDrone = { osc1, osc2, gain: gainNode };
  } catch (err) {
    console.error("Ambient drone start failed: ", err);
  }
}

export function stopAmbientDrone() {
  if (ambientDrone) {
    try {
      ambientDrone.osc1.stop();
      ambientDrone.osc2.stop();
    } catch (e) {}
    ambientDrone = null;
  }
}
