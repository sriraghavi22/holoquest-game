// Player.js
import * as THREE from 'three';
import { eventBus } from './eventBus';
import GestureControls from '../input/gestureControls.js'; // Adjust path as needed

class Player {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.position = new THREE.Vector3(0, 1.7, 5);
    this.velocity = new THREE.Vector3();
    this.speed = 7.0; // Adjusted back to original for consistency
    this.jumpStrength = 10.0;
    this.gravity = 20.0;
    this.keys = { w: false, a: false, s: false, d: false, space: false };
    this.height = 5; // Match original
    this.radius = 0.3;
    this.onGround = false;
    this.lookSpeed = 0.003;
    this.canMove = false;
    this.interactiveObjects = [];
    this.lastTriggerTime = 0;
    // Room boundaries (adjust these based on your room size)
    this.roomBounds = {
      minX: -9.5, maxX: 9.5, // Assuming room width is 20
      minZ: -9.5, maxZ: 9.5, // Assuming room depth is 20
      minY: 0, maxY: 10      // Assuming room height is 10
    };
    this.gesturePosition = new THREE.Vector3(); // For gesture movement
    this.gestureControls = null; // For gesture handling
  }

  init() {
    this.camera.position.copy(this.position);
  this.camera.lookAt(0, 1.7, 0);

  this.gestureControls = new GestureControls();
  this.gestureControls.init().catch(error => console.error('GestureControls init failed:', error));

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'w': this.keys.w = true; break;
      case 's': this.keys.s = true; break;
      case 'a': this.keys.a = true; break;
      case 'd': this.keys.d = true; break;
      case ' ': this.keys.space = true; break;
    }
  });
  document.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'w': this.keys.w = false; break;
      case 's': this.keys.s = false; break;
      case 'a': this.keys.a = false; break;
      case 'd': this.keys.d = false; break;
      case ' ': this.keys.space = false; break;
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body) {
      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;
      this.camera.rotation.y -= movementX * this.lookSpeed;
      this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x - movementY * this.lookSpeed));
    }
  });
    // Event listeners for game states (original)
    eventBus.on('game:start', () => {
      document.body.requestPointerLock();
      this.canMove = true;
      console.log('[Player] Game started, pointer locked');
    });
    eventBus.on('game:pause', () => {
      this.canMove = false;
      document.exitPointerLock();
      console.log('[Player] Game paused, pointer unlocked');
    });
    eventBus.on('game:resume', () => {
      document.body.requestPointerLock();
      this.canMove = true;
      console.log('[Player] Game resumed, pointer locked');
    });

    document.addEventListener('pointerlockchange', () => {
      this.canMove = document.pointerLockElement === document.body;
      console.log('[Player] Pointer lock changed, canMove:', this.canMove);
    });

    // Add gesture movement listener
    eventBus.on('playerMove', ({ directionX, directionZ, speed }) => {
      if (this.canMove) { // Only apply if player can move
        this.gesturePosition.x += directionX * speed * 0.1; // Scale down for balance
        this.gesturePosition.z += directionZ * speed * 0.1;
        console.log(`[DEBUG] Player gesture position updated to x: ${this.gesturePosition.x}, z: ${this.gesturePosition.z}`);
      }
    });

    this.createPlayerBody();
    return this;
  }

  createPlayerBody() {
    const geometry = new THREE.CylinderGeometry(this.radius, this.radius, this.height, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0x0000ff, opacity: 0.5, transparent: true });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.position.y -= this.height / 2; // Center at feet
    this.scene.add(this.mesh);
  }

  setInteractiveObjects(objects) {
    if (!Array.isArray(objects)) {
      console.error('setInteractiveObjects received invalid input:', objects);
      this.interactiveObjects = [];
      return;
    }
    this.interactiveObjects = objects.filter(obj => {
      if (!obj || !obj.userData || typeof obj.userData.name !== 'string') {
        console.warn('Skipping invalid interactive object:', obj);
        return false;
      }
      return obj.userData.name.startsWith('floor_trigger_');
    });
  }

  checkFloorTriggers() {
    const now = Date.now();
    if (now - this.lastTriggerTime < 1000) return;

    this.interactiveObjects.forEach(obj => {
      const distance = this.position.distanceTo(obj.position);
      if (distance < 0.5 && obj.userData.interactable) {
        obj.userData.action();
        this.lastTriggerTime = now;
        eventBus.emit('showMessage', `Stepped on ${obj.userData.name.split('_')[2]} circle!`);
      }
    });
  }

  update(deltaTime, colliders) {
    if (!this.canMove) {
      console.log('Update skipped: Player cannot move');
      return;
    }

    // Debug logging
    if (!colliders || colliders.length === 0) {
      console.warn('[DEBUG] No colliders passed to player update!');
    } else {
      console.log('[DEBUG] Checking collisions with', colliders.length, 'objects');
    }

    // Calculate movement direction (keyboard + gesture)
    const moveDirection = new THREE.Vector3();
    if (this.keys.w) moveDirection.z -= 1;
    if (this.keys.s) moveDirection.z += 1;
    if (this.keys.a) moveDirection.x -= 1;
    if (this.keys.d) moveDirection.x += 1;

    // Add gesture movement
    moveDirection.x += this.gesturePosition.x;
    moveDirection.z += this.gesturePosition.z;
    this.gesturePosition.set(0, 0, 0); // Reset after applying

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize().applyQuaternion(this.camera.quaternion);
      moveDirection.y = 0;
      moveDirection.normalize().multiplyScalar(this.speed * deltaTime);
    }

    // Handle jumping and gravity (original)
    if (this.onGround && this.keys.space) {
      this.velocity.y = this.jumpStrength;
      this.onGround = false;
    }
    this.velocity.y -= this.gravity * deltaTime;

    // Proposed new position
    const newPosition = this.position.clone();
    newPosition.addScaledVector(moveDirection, 1); // Horizontal movement (keyboard + gesture)
    newPosition.y += this.velocity.y * deltaTime; // Vertical movement

    // Player bounding box
    const playerBox = new THREE.Box3();
    const playerSize = new THREE.Vector3(this.radius * 2, this.height, this.radius * 2);
    playerBox.setFromCenterAndSize(newPosition, playerSize);

    // Check collisions with all colliders (original)
    let collisionDetected = false;
    for (const object of colliders) {
      if (object === this.mesh || !object.userData || !object.userData.isCollider) continue;

      const objectBox = new THREE.Box3().setFromObject(object);
      if (playerBox.intersectsBox(objectBox)) {
        collisionDetected = true;

        // Calculate penetration depth and push back (original)
        const penetration = this.calculatePenetration(playerBox, objectBox);
        newPosition.add(penetration); // Adjust position to resolve collision
        playerBox.setFromCenterAndSize(newPosition, playerSize); // Update box for next check

        // Stop velocity in the direction of collision
        if (penetration.y > 0) {
          this.velocity.y = 0;
          this.onGround = true;
          newPosition.y = objectBox.max.y + this.height / 2; // Place on top
        } else if (penetration.y < 0) {
          this.velocity.y = 0;
          newPosition.y = objectBox.min.y - this.height / 2; // Hit ceiling
        }
      }
    }

    // Enforce room boundaries (original)
    newPosition.x = Math.max(this.roomBounds.minX + this.radius, Math.min(this.roomBounds.maxX - this.radius, newPosition.x));
    newPosition.z = Math.max(this.roomBounds.minZ + this.radius, Math.min(this.roomBounds.maxZ - this.radius, newPosition.z));
    newPosition.y = Math.max(this.roomBounds.minY + this.height / 2, Math.min(this.roomBounds.maxY - this.height / 2, newPosition.y));

    // Apply floor collision (original)
    if (newPosition.y <= this.height / 2) {
      newPosition.y = this.height / 2;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Update position if no collision or after resolution (original)
    if (!collisionDetected || true) { // Always apply resolved position
      this.position.copy(newPosition);
    }

    // Update camera and mesh (original)
    this.camera.position.copy(this.position);
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.position.y -= this.height / 2; // Center at feet
    }

    this.checkFloorTriggers();
  }

  calculatePenetration(playerBox, objectBox) {
    const penetration = new THREE.Vector3();
    const playerCenter = playerBox.getCenter(new THREE.Vector3());
    const objectCenter = objectBox.getCenter(new THREE.Vector3());
    const playerSize = playerBox.getSize(new THREE.Vector3());
    const objectSize = objectBox.getSize(new THREE.Vector3());

    const dx = playerCenter.x - objectCenter.x;
    const dy = playerCenter.y - objectCenter.y;
    const dz = playerCenter.z - objectCenter.z;

    const overlapX = (playerSize.x + objectSize.x) / 2 - Math.abs(dx);
    const overlapY = (playerSize.y + objectSize.y) / 2 - Math.abs(dy);
    const overlapZ = (playerSize.z + objectSize.z) / 2 - Math.abs(dz);

    if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
      // Find the smallest overlap to resolve along that axis
      const minOverlap = Math.min(overlapX, overlapY, overlapZ);
      if (minOverlap === overlapX) {
        penetration.x = dx > 0 ? overlapX : -overlapX;
      } else if (minOverlap === overlapY) {
        penetration.y = dy > 0 ? overlapY : -overlapY;
      } else {
        penetration.z = dz > 0 ? overlapZ : -overlapZ;
      }
    }

    return penetration;
  }

  destroy() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    if (this.gestureControls) this.gestureControls.dispose();
    if (this.mesh && this.scene) this.scene.remove(this.mesh);
  }
}

export { Player };