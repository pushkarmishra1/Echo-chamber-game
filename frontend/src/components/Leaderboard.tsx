import React, { useState, useEffect } from 'react';

import { motion } from 'motion/react';
import { Trophy, Clock, Heart, Award, RefreshCw, Send, Sparkles, User } from 'lucide-react';
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface LeaderboardProps {
  onlyView?: boolean;
  timeTaken?: number;
  sanityRemaining?: number;
  onClose?: () => void;
}

interface ScoreEntry {
  _id: string;
  playerName: string;
  timeTaken: number;
  sanityRemaining: number;
  createdAt: string;
}

export default function Leaderboard({ onlyView = true, timeTaken = 0, sanityRemaining = 3, onClose }: LeaderboardProps) {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Fetch leaderboards
  const fetchScores = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/scores`);
      if (!response.ok) {
        throw new Error('Failed to retrieve rankings');
      }
      const data = await response.json();
      setScores(data);
    } catch (err: any) {
      console.error(err);
      setError('Could not connect to leaderboard. Running locally.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  // Submit high score
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName: playerName.trim(),
          timeTaken,
          sanityRemaining,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post high score');
      }

      setSubmitted(true);
      fetchScores(); // Refresh rankings
    } catch (err: any) {
      console.error(err);
      setError('Error uploading score to server. Logged in session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-5 bg-black/60 border border-slate-900/80 backdrop-blur rounded-2xl p-4 sm:p-6 shadow-2xl relative">
      
      {/* Decorative Corners */}
      <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t border-l border-cyan-500/40 rounded-tl pointer-events-none" />
      <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t border-r border-cyan-500/40 rounded-tr pointer-events-none" />
      <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b border-l border-cyan-500/40 rounded-bl pointer-events-none" />
      <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b border-r border-cyan-500/40 rounded-br pointer-events-none" />

      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-900/60 pb-3 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Trophy className="w-5 h-5 text-amber-500 shadow-glow" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold tracking-[0.15em] text-cyan-400 font-mono uppercase">
              GLOBAL LEADERBOARD
            </h3>
            <p className="text-[8px] text-slate-500 font-mono uppercase tracking-wider">
              Resonance Chamber Record Archives
            </p>
          </div>
        </div>
        <button 
          onClick={fetchScores}
          className="p-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-cyan-400 rounded-lg transition-all cursor-pointer"
          title="Refresh rankings"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Submit Score Form (If not onlyView) */}
      {!onlyView && !submitted && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-950/20 border border-purple-900/40 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center space-x-1.5 text-purple-400 font-mono text-[9px] uppercase font-bold tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>Archive Your Survival Record</span>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
              <input
                type="text"
                maxLength={20}
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="ENTER YOUR SURVIVOR CALLSIGN..."
                className="w-full bg-black/80 border border-purple-950 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-semibold text-slate-200 uppercase tracking-widest focus:outline-none focus:border-purple-500 placeholder-purple-950"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !playerName.trim()}
              className="px-5 py-2 bg-purple-900/60 hover:bg-purple-800/80 border border-purple-700 hover:border-purple-500 text-purple-200 hover:text-white rounded-xl text-xs font-mono font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Send className="w-3 h-3" />
              <span>{submitting ? 'RECORDING...' : 'TRANSMIT'}</span>
            </button>
          </form>
        </motion.div>
      )}

      {/* Submission Success Banner */}
      {submitted && !onlyView && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 rounded-xl p-3.5 text-center text-[10px] font-mono tracking-widest uppercase flex items-center justify-center gap-2"
        >
          <Award className="w-4 h-4 text-emerald-400 animate-bounce" />
          <span>SURVIVOR TRANSMISSION ARCHIVED SUCCESSFULLY</span>
        </motion.div>
      )}

      {/* Score Grid/List */}
      <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin scrollbar-thumb-cyan-950 scrollbar-track-transparent space-y-1.5">
        {loading && scores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 text-slate-500 font-mono text-[10px]">
            <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
            <span className="uppercase tracking-widest">SCANNING DATA BANKS...</span>
          </div>
        ) : error && scores.length === 0 ? (
          <div className="text-center py-8 text-red-400/80 font-mono text-[9px] uppercase tracking-wider leading-relaxed">
            {error}
          </div>
        ) : scores.length === 0 ? (
          <div className="text-center py-10 text-slate-600 font-mono text-[10px] uppercase tracking-widest">
            NO SIMULATION RECORDS FOUND
          </div>
        ) : (
          <div className="space-y-1.5">
            {scores.map((score, idx) => {
              const isTop3 = idx < 3;
              const rankColor = idx === 0 
                ? 'text-amber-400 border-amber-500/30 bg-amber-500/5' 
                : idx === 1 
                  ? 'text-slate-300 border-slate-400/30 bg-slate-400/5' 
                  : idx === 2 
                    ? 'text-amber-600 border-amber-700/30 bg-amber-700/5'
                    : 'text-slate-500 border-slate-900 bg-slate-950/20';

              return (
                <motion.div
                  key={score._id || idx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`flex items-center justify-between px-3 py-2 border rounded-xl font-mono text-[10px] sm:text-[11px] hover:bg-slate-900/40 transition-colors ${rankColor}`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="font-bold text-xs w-4 text-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold tracking-widest uppercase text-slate-200 truncate max-w-[120px] sm:max-w-[180px]">
                      {score.playerName}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 flex-shrink-0 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Heart className="w-3 h-3 fill-emerald-500/20" />
                      {score.sanityRemaining}/3
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Clock className="w-3 h-3" />
                      {score.timeTaken}s
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-slate-300 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer text-center"
        >
          CLOSE PROTOCOL
        </button>
      )}

    </div>
  );
}
