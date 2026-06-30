import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000; // Hardcoded container port

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// 1. MONGOOSE SCHEMA & MODEL FOR SCORES (TYPESCRIPT PORT)
// -------------------------------------------------------------
const ScoreSchema = new mongoose.Schema({
  playerName: { type: String, required: true, trim: true },
  timeTaken: { type: Number, required: true },
  sanityRemaining: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Avoid OverwriteModelError if model is compiled multiple times
const Score = mongoose.models.Score || mongoose.model('Score', ScoreSchema);

// In-memory local leaderboard fallback when MongoDB is not connected/configured
let inMemoryLeaderboard: Array<{
  _id: string;
  playerName: string;
  timeTaken: number;
  sanityRemaining: number;
  createdAt: Date;
}> = [
  { _id: 'local_1', playerName: 'EcoExplorer', timeTaken: 45, sanityRemaining: 3, createdAt: new Date() },
  { _id: 'local_2', playerName: 'SightlessRun', timeTaken: 62, sanityRemaining: 3, createdAt: new Date() },
  { _id: 'local_3', playerName: 'SonarMaster', timeTaken: 55, sanityRemaining: 2, createdAt: new Date() },
  { _id: 'local_4', playerName: 'PanicWanderer', timeTaken: 95, sanityRemaining: 1, createdAt: new Date() },
];

// Connection flag
const MONGODB_URI = process.env.MONGODB_URI;
let dbConnected = false;

if (MONGODB_URI) {
  console.log('Connecting to MongoDB...');
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB successfully via root server.ts');
      dbConnected = true;
    })
    .catch((err) => {
      console.error('Database connection error in server.ts:', err.message);
    });
} else {
  console.log('No MONGODB_URI configured in environment variables. Leaderboard will run in Local/In-Memory mode.');
}

// -------------------------------------------------------------
// 2. API ENDPOINTS
// -------------------------------------------------------------

// POST /api/scores - Submit a new player score
app.post('/api/scores', async (req, res) => {
  try {
    const { playerName, timeTaken, sanityRemaining } = req.body;

    if (!playerName || timeTaken === undefined || sanityRemaining === undefined) {
      return res.status(400).json({ error: 'Please provide playerName, timeTaken, and sanityRemaining' });
    }

    if (dbConnected) {
      const score = new Score({
        playerName,
        timeTaken: Number(timeTaken),
        sanityRemaining: Number(sanityRemaining)
      });
      const savedScore = await score.save();
      return res.status(201).json(savedScore);
    } else {
      // Create local fallback entry
      const localEntry = {
        _id: 'local_' + Math.random().toString(36).substr(2, 9),
        playerName,
        timeTaken: Number(timeTaken),
        sanityRemaining: Number(sanityRemaining),
        createdAt: new Date()
      };
      inMemoryLeaderboard.push(localEntry);
      
      // Sort: Sanity Remaining desc, then Time Taken asc
      inMemoryLeaderboard.sort((a, b) => {
        if (b.sanityRemaining !== a.sanityRemaining) {
          return b.sanityRemaining - a.sanityRemaining;
        }
        return a.timeTaken - b.timeTaken;
      });

      return res.status(201).json(localEntry);
    }
  } catch (err: any) {
    console.error('Error in POST /api/scores:', err);
    return res.status(500).json({ error: 'Server error saving score', details: err.message });
  }
});

// GET /api/scores - Get top 10 leaderboards
app.get('/api/scores', async (req, res) => {
  try {
    if (dbConnected) {
      const scores = await Score.find()
        .sort({ sanityRemaining: -1, timeTaken: 1 })
        .limit(10);
      return res.json(scores);
    } else {
      // Return top 10 from in-memory leaderboard
      return res.json(inMemoryLeaderboard.slice(0, 10));
    }
  } catch (err: any) {
    console.error('Error in GET /api/scores:', err);
    return res.status(500).json({ error: 'Server error fetching scores', details: err.message });
  }
});

// Health status check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbConnected });
});

// -------------------------------------------------------------
// 3. VITE DEVELOPER/PRODUCTION MIDDLEWARE
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      root: path.join(process.cwd(), 'frontend'),
      configFile: path.join(process.cwd(), 'frontend', 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fullstack server running at http://localhost:${PORT}`);
  });
}

startServer();
