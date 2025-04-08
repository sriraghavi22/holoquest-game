import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

class CapsuleGeometry extends THREE.BufferGeometry {
  constructor(radius = 1, length = 2, capSegments = 8, radialSegments = 8) {
    super();

    const halfLength = length / 2;
    const sphereGeometry = new THREE.SphereGeometry(radius, capSegments, radialSegments, 0, Math.PI * 2, 0, Math.PI);
    const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1, true);

    const sphereTop = sphereGeometry.clone();
    sphereTop.translate(0, halfLength, 0);

    const sphereBottom = sphereGeometry.clone();
    sphereBottom.rotateX(Math.PI);
    sphereBottom.translate(0, -halfLength, 0);

    const cylinder = cylinderGeometry.clone();

    this.mergeGeometries([sphereTop, sphereBottom, cylinder]);
  }

  mergeGeometries(geometries) {
    const mergedGeometry = mergeGeometries(geometries);
    this.copy(mergedGeometry);
  }
}

export { CapsuleGeometry };