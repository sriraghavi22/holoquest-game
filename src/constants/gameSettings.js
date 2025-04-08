// src/constants/gameSettings.js

export const GameSettings = {
    // General game settings
    GAME_NAME: 'HoloQuest',
    DEBUG_MODE: true,
    
    // Player settings
    PLAYER_HEIGHT: 1.7, // meters
    MOVEMENT_SPEED: 5, // units per second
    LOOK_SPEED: 0.002, // mouse sensitivity
    
    // Room settings
    ROOM_WIDTH: 10,
    ROOM_HEIGHT: 3,
    ROOM_DEPTH: 8,
    
    // Interaction settings
    INTERACTION_DISTANCE: 3, // max distance for interaction
    HIGHLIGHT_COLOR: 0x66aaff, // blue-ish highlight for interactive objects
    
    // Rendering settings
    FOV: 75,
    NEAR_PLANE: 0.1,
    FAR_PLANE: 1000,
    SHADOW_MAP_SIZE: 1024,
    ANTIALIASING: true,
    
    // Helper functions
    isDebugMode() {
        return this.DEBUG_MODE;
    },
    
    getAspectRatio() {
        return window.innerWidth / window.innerHeight;
    },
    
    // Future phases can add more settings here
    PUZZLE_DIFFICULTY: 'medium',
    AMBIENT_SOUND_VOLUME: 0.3,
    EFFECT_SOUND_VOLUME: 0.7
};