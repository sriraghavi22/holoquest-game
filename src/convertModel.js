// src/convertModel.js
const fs = require('fs').promises;
const path = require('path');

async function convertModel() {
  const sourceDir = path.join(__dirname, 'models', 'dqn-skill-model');
  const targetDir = path.join(__dirname, '..', 'public', 'models', 'dqn-skill-model');

  try {
    await fs.mkdir(targetDir, { recursive: true });

    // Copy model.json
    await fs.copyFile(
      path.join(sourceDir, 'model.json'),
      path.join(targetDir, 'model.json')
    );
    console.log('[DEBUG] Copied model.json');

    // Copy weights.bin
    await fs.copyFile(
      path.join(sourceDir, 'weights.bin'),
      path.join(targetDir, 'weights.bin')
    );
    console.log('[DEBUG] Copied weights.bin');

    console.log('[DEBUG] Model converted and saved to', targetDir);
  } catch (e) {
    console.error('[ERROR] Failed to convert model:', e.message);
  }
}

convertModel().catch(console.error);