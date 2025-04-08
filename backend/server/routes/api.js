const express = require('express');
const router = express.Router();
const GameSession = require('../models/gameSession');

// Save metrics
router.post('/save-metrics', async (req, res) => {
  console.log('Received metrics:', req.body);
  try {
    const session = new GameSession({
      ...req.body, // Use all incoming data, including sessionId
    });
    await session.save();
    res.status(200).json({ message: 'Metrics saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.error('Error saving metrics:', err);
  }
});

// Get all sessions (for training later)
router.get('/metrics', async (req, res) => {
  try {
    const sessions = await GameSession.find();
    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.error('Error fetching metrics:', err);
    console.log(err);
  }
});

module.exports = router;