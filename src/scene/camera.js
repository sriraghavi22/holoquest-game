import * as THREE from 'three';

export function setupCamera() {
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  
  camera.position.set(0, 1.6, 5);
  camera.lookAt(0, 1.6, -5);
  camera.rotation.order = 'YXZ';
  
  return camera;
}

export function updateCameraAspect(camera) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

export function setCameraPosition(camera, position) {
  camera.position.copy(position);
}

export function setCameraRotation(camera, rotation) {
  camera.rotation.set(rotation.x, rotation.y, rotation.z);
}

export function lookAt(camera, target) {
  camera.lookAt(target);
}