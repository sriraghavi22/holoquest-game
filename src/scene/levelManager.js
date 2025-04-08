// src/scene/levelManager.js
import { Room } from './room';
import { ScholarsLibrary } from './scholarsLibrary';
import { CelestialForge } from './celestialForge';
import { DesertEscape } from './etherealClocktower';
import {VerdantLabyrinth} from './verdantLabyrinth';
import { LunarCommandNexus } from './puzle3';
const levels = {
  'room': Room,
  'scholarsLibrary': ScholarsLibrary,
  'celestialForge': CelestialForge,
  'etherealClocktower': DesertEscape,
  'verdantLabyrinth': VerdantLabyrinth,
  'puzle3': LunarCommandNexus
};

export class LevelManager {
  static getLevel(levelId, scene, skillLevel) {
    const LevelClass = levels[levelId];
    if (!LevelClass) {
      throw new Error(`Level ${levelId} not found`);
    }
    return new LevelClass(scene, skillLevel);
  }

  static getLevelIds() {
    return Object.keys(levels);
  }

  // Get the next level ID for progression
  static getNextLevelId(currentLevelId) {
    const levelIds = Object.keys(levels);
    const currentIndex = levelIds.indexOf(currentLevelId);
    if (currentIndex === -1 || currentIndex === levelIds.length - 1) {
      return null; // No next level
    }
    return levelIds[currentIndex + 1];
  }
}