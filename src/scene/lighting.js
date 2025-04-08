import * as THREE from 'three';

export function setupLighting(scene) {
  const lights = {};
  const baseIntensity = 2.0; // Unified intensity for all lights
  
  // Add ambient light for general illumination (brighter for even coverage)
  lights.ambient = new THREE.AmbientLight(0x808080, baseIntensity); // Increased color brightness
  scene.add(lights.ambient);
  
  // Main directional light (adjusted to point downward for full room coverage)
  lights.directional = new THREE.DirectionalLight(0xffffff, baseIntensity);
  lights.directional.position.set(0, 10, 0); // Centered above room
  lights.directional.target = new THREE.Object3D(); // Explicit target
  lights.directional.target.position.set(0, 0, 0); // Point straight down
  scene.add(lights.directional.target);
  scene.add(lights.directional);
  
  // Point light 1 (moved to better cover front/left)
  lights.point1 = new THREE.PointLight(0xffcc77, baseIntensity, 25); // Increased range
  lights.point1.position.set(-8, 5, 8); // Near front-left corner
  scene.add(lights.point1);
  
  // Point light 2 (moved to cover front/right)
  lights.point2 = new THREE.PointLight(0x77ccff, baseIntensity, 25); // Increased range
  lights.point2.position.set(8, 5, 8); // Near front-right corner
  scene.add(lights.point2);
  
  // Point light 3 (ceiling center, unchanged position but increased range)
  lights.point3 = new THREE.PointLight(0xffffff, baseIntensity, 25); // Increased range
  lights.point3.position.set(0, 10, 0); // Center top
  scene.add(lights.point3);
  
  return lights;
}

export function toggleShadows(lights, enabled) {
  // No-op since shadows are disabled
  for (const key in lights) {
    if (lights[key].castShadow !== undefined) {
      lights[key].castShadow = enabled;
    }
  }
}

export function updateLightIntensity(lights, intensity) {
  // Apply the same intensity to all lights without multipliers
  if (lights.ambient) {
    lights.ambient.intensity = intensity;
  }
  
  if (lights.directional) {
    lights.directional.intensity = intensity;
  }
  
  if (lights.point1) {
    lights.point1.intensity = intensity;
  }
  
  if (lights.point2) {
    lights.point2.intensity = intensity;
  }
  
  if (lights.point3) {
    lights.point3.intensity = intensity;
  }
}