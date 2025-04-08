import * as THREE from 'three';

export function setupRenderer() {
  // Try to get the existing canvas
  let canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.warn('Canvas with id "game-canvas" not found. Creating one dynamically.');
    canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    canvas.style.display = 'block'; // Ensure it’s visible
    document.body.appendChild(canvas);
  }

  // Create WebGL renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });

  // Verify canvas is attached
  if (!renderer.domElement || renderer.domElement !== canvas) {
    console.error('Failed to initialize renderer with canvas');
    return null;
  }

  // Configure renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Set background color
  renderer.setClearColor(0x000000);

  // Enable tone mapping for improved visual quality
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Set output color space
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  return renderer;
}

export function updateRendererSize(renderer) {
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

export function enableShadows(renderer, enabled) {
  if (renderer) {
    renderer.shadowMap.enabled = enabled;
  }
}

export function setPixelRatio(renderer, ratio) {
  if (renderer) {
    renderer.setPixelRatio(ratio);
  }
}