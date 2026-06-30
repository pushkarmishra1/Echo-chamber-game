const express = require('express');
const router = express.Router();
const Score = require('../models/Score');

// POST /api/scores - Submit a new score
router.post('/', async (req, res) => {
  try {
    const { playerName, timeTaken, sanityRemaining } = req.body;
    
    if (!playerName || timeTaken === undefined || sanityRemaining === undefined) {
      return res.status(400).json({ error: 'Please provide playerName, timeTaken, and sanityRemaining' });
    }

    const newScore = new Score({
      playerName,
      timeTaken: Number(timeTaken),
      sanityRemaining: Number(sanityRemaining)
    });

    const savedScore = await newScore.save();
    res.status(201).json(savedScore);
  } catch (err) {
    res.status(500).json({ error: 'Server error saving score', details: err.message });
  }
});

// GET /api/scores - Fetch top 10 scores (sorted by sanityRemaining desc, timeTaken asc)
router.get('/', async (req, res) => {
  try {
    const topScores = await Score.find()
      .sort({ sanityRemaining: -1, timeTaken: 1 })
      .limit(10);
    res.json(topScores);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching scores', details: err.message });
  }
});

module.exports = router;
