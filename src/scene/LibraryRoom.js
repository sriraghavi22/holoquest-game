import * as THREE from 'three';
import { BaseRoom } from './BaseRoom';
import { eventBus } from '../game/eventBus';

export class LibraryRoom extends BaseRoom {
  constructor(scene) {
    super(scene);
    this.bookOrder = ['red', 'blue', 'green']; // Correct order for puzzle
    this.currentOrder = []; // Tracks player’s book arrangement
    this.hiddenMessage = null; // For orb puzzle
  }

  async createRoom() {
    // Call parent to set up basic floor and ceiling
    await super.createRoom();

    // Customize floor to polished wood
    const floor = this.children.find(child => child.name === 'floor');
    if (floor) {
      const polishedWoodTexture = await this.loadTexture('/assets/textures/polished_wood.jpg');
      polishedWoodTexture.wrapS = THREE.RepeatWrapping;
      polishedWoodTexture.wrapT = THREE.RepeatWrapping;
      polishedWoodTexture.repeat.set(8, 8);
      floor.material.map = polishedWoodTexture;
      floor.material.color.set(0x5C4033); // Darker wood tone
      floor.material.roughness = 0.6;
      floor.material.metalness = 0.1;
    }

    // Customize ceiling (keep it simple, slightly dusty vibe)
    const ceiling = this.children.find(child => child.name === 'ceiling');
    if (ceiling) {
      ceiling.material.color.set(0x8B4513); // Wood tone
      ceiling.material.roughness = 0.9; // Dustier look
    }

    // Wooden paneled walls with bookshelf texture
    const wallTexture = await this.loadTexture('/assets/textures/bookshelf_wall.jpg');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(4, 2);
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    // Override front wall with door and panels
    const frontWallLeft = new THREE.Mesh(
      new THREE.BoxGeometry(this.roomSize.width * 0.3, this.roomSize.height, this.wallThickness),
      wallMaterial
    );
    frontWallLeft.position.set(-this.roomSize.width * 0.35, this.roomSize.height / 2, this.roomSize.depth / 2);
    this.add(frontWallLeft);
    this.addCollisionBox(frontWallLeft);

    const frontWallRight = new THREE.Mesh(
      new THREE.BoxGeometry(this.roomSize.width * 0.3, this.roomSize.height, this.wallThickness),
      wallMaterial
    );
    frontWallRight.position.set(this.roomSize.width * 0.35, this.roomSize.height / 2, this.roomSize.depth / 2);
    this.add(frontWallRight);
    this.addCollisionBox(frontWallRight);

    const frontWallTop = new THREE.Mesh(
      new THREE.BoxGeometry(this.roomSize.width * 0.4, this.roomSize.height * 0.3, this.wallThickness),
      wallMaterial
    );
    frontWallTop.position.set(0, this.roomSize.height * 0.85, this.roomSize.depth / 2);
    this.add(frontWallTop);
    this.addCollisionBox(frontWallTop);

    // Locked cabinet as exit (replaces door)
    const cabinetMaterial = new THREE.MeshStandardMaterial({
      color: 0x4A2F1A, // Dark wood
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const cabinetGeometry = new THREE.BoxGeometry(this.roomSize.width * 0.4, this.roomSize.height * 0.7, this.wallThickness * 1.5);
    const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
    cabinet.position.set(0, this.roomSize.height * 0.35, this.roomSize.depth / 2);
    cabinet.name = 'cabinet';
    cabinet.userData.locked = true;
    this.add(cabinet);
    this.makeObjectInteractive(cabinet, {
      name: 'cabinet',
      type: 'exit',
      interactable: true,
      action: (inventory) => {
        if (this.isBookOrderCorrect() && inventory.hasItem('scroll')) {
          eventBus.emit('game:win');
          eventBus.emit('showMessage', 'The cabinet swings open—you escape with the scroll!');
          cabinet.rotation.y = Math.PI / 2; // Visual feedback
        } else if (!this.isBookOrderCorrect()) {
          eventBus.emit('showMessage', 'The books must be arranged in the correct order.');
        } else {
          eventBus.emit('showMessage', 'The cabinet requires a scroll to unlock.');
        }
      }
    });
  }

  async addFurniture() {
    // Desk
    try {
      const desk = await this.loadModel('/assets/models/desk.glb');
      desk.scale.set(1.5, 1.5, 1.5);
      desk.position.set(0, 0, -5);
      this.add(desk);
      this.objects.push(desk);
      this.addCollisionBox(desk, new THREE.Vector3(3, 1.5, 2));
    } catch (error) {
      console.error('Error loading desk model:', error);
      this.createSimpleDesk();
    }

    // Bookshelf (reusing StorageRoom asset)
    try {
      const bookshelf = await this.loadModel('/assets/models/bookshelf.glb');
      bookshelf.scale.set(2, 2, 2);
      bookshelf.position.set(-8, 0, -9);
      bookshelf.rotation.y = Math.PI;
      this.add(bookshelf);
      this.objects.push(bookshelf);
      this.addCollisionBox(bookshelf, new THREE.Vector3(2, 4, 1));
    } catch (error) {
      console.error('Error loading bookshelf model:', error);
      this.createSimpleBookshelf();
    }
  }

  async addInteractiveObjects() {
    // Glowing Orb on Desk
    const orbGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x00FFFF,
      emissive: 0x00FFFF,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8
    });
    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    orb.position.set(0, 0.8, -5);
    orb.name = 'orb';
    this.add(orb);
    this.makeObjectInteractive(orb, {
      name: 'orb',
      type: 'collectible',
      interactable: true,
      action: (inventory) => {
        if (!inventory.hasItem('orb')) {
          eventBus.emit('collectItem', { id: 'orb', name: 'Glowing Orb', description: 'A magical orb pulsing with light.' });
          eventBus.emit('showMessage', 'You picked up the glowing orb!');
          orb.visible = false;
        }
      }
    });

    // Desk Interaction (place orb)
    const desk = this.objects.find(obj => obj.position.x === 0 && obj.position.z === -5);
    if (desk) {
      this.makeObjectInteractive(desk, {
        name: 'desk',
        type: 'puzzle',
        interactable: true,
        action: (inventory) => {
          if (inventory.hasItem('orb')) {
            eventBus.emit('orb:placed');
            eventBus.emit('showMessage', 'The orb glows brighter, illuminating a hidden message!');
            inventory.items = inventory.items.filter(item => item.id !== 'orb');
            eventBus.emit('inventory:updated', inventory);
            orb.position.set(0, 0.8, -5); // Place orb back visually
            orb.visible = true;
          } else {
            eventBus.emit('showMessage', 'The desk has a circular indentation—perhaps something fits here.');
          }
        }
      });
    }

    // Books for Book Code Puzzle
    const bookColors = { red: 0xFF0000, blue: 0x0000FF, green: 0x00FF00 };
    Object.entries(bookColors).forEach(([color, hex], i) => {
      const bookGeometry = new THREE.BoxGeometry(0.2, 1.5, 0.3);
      const bookMaterial = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0.1 });
      const book = new THREE.Mesh(bookGeometry, bookMaterial);
      book.position.set(-8 + i * 0.3 - 0.3, 1.5, -8.5);
      book.name = `${color}Book`;
      this.add(book);
      this.makeObjectInteractive(book, {
        name: `${color}Book`,
        type: 'puzzle',
        interactable: true,
        action: () => {
          this.currentOrder = this.currentOrder.filter(b => b !== color);
          this.currentOrder.push(color);
          book.position.x += 0.1; // Visual feedback
          setTimeout(() => book.position.x -= 0.1, 100);
          eventBus.emit('showMessage', `Moved the ${color} book. Current order: ${this.currentOrder.join(', ')}`);
        }
      });
    });

    // Hidden Message (Orb Activation)
    eventBus.on('orb:placed', () => this.showHiddenMessage());
  }

  createSimpleDesk() {
    const deskMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.8, metalness: 0.1 });
    const topGeometry = new THREE.BoxGeometry(3, 0.2, 2);
    const top = new THREE.Mesh(topGeometry, deskMaterial);
    top.position.set(0, 1.5, -5);
    
    const legGeometry = new THREE.BoxGeometry(0.2, 1.5, 0.2);
    const legPositions = [
      [1.3, 0.75, 0.8], [-1.3, 0.75, 0.8], [1.3, 0.75, -0.8], [-1.3, 0.75, -0.8]
    ];
    
    const desk = new THREE.Group();
    desk.add(top);
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeometry, deskMaterial);
      leg.position.set(pos[0], pos[1], pos[2]);
      desk.add(leg);
    });
    
    desk.position.set(0, 0, -5);
    this.add(desk);
    this.objects.push(desk);
    this.addCollisionBox(desk, new THREE.Vector3(3, 1.5, 2));
  }

  createSimpleBookshelf() {
    const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, metalness: 0.1 });
    const frameGeometry = new THREE.BoxGeometry(2, 4, 0.5);
    const frame = new THREE.Mesh(frameGeometry, shelfMaterial);
    const shelfGeometry = new THREE.BoxGeometry(1.8, 0.1, 0.4);
    const shelfPositions = [
      [0, -1.5, 0], [0, -0.5, 0], [0, 0.5, 0], [0, 1.5, 0]
    ];
    
    const bookshelf = new THREE.Group();
    bookshelf.add(frame);
    shelfPositions.forEach(pos => {
      const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
      shelf.position.set(pos[0], pos[1], pos[2]);
      bookshelf.add(shelf);
    });
    
    bookshelf.position.set(-8, 2, -9);
    this.add(bookshelf);
    this.objects.push(bookshelf);
    this.addCollisionBox(bookshelf, new THREE.Vector3(2, 4, 1));
  }

  showHiddenMessage() {
    if (!this.hiddenMessage) {
      const messageGeometry = new THREE.PlaneGeometry(4, 1);
      const messageMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00, side: THREE.DoubleSide });
      this.hiddenMessage = new THREE.Mesh(messageGeometry, messageMaterial);
      this.hiddenMessage.position.set(0, 4, -9.8);
      this.hiddenMessage.name = 'hiddenMessage';
      this.add(this.hiddenMessage);
      this.makeObjectInteractive(this.hiddenMessage, {
        name: 'hiddenMessage',
        type: 'readable',
        interactable: true,
        action: (inventory) => {
          eventBus.emit('collectItem', { id: 'scroll', name: 'Ancient Scroll', description: 'A scroll with a riddle.' });
          eventBus.emit('showReadable', {
            text: 'Riddle: "I am taken from a mine, and shut up in a wooden case, from which I am never released, and yet I am used by almost every person. What am I?" (Answer: Pencil)'
          });
          eventBus.emit('showMessage', 'You found a scroll with a riddle!');
          this.hiddenMessage.visible = false;
        }
      });
    }
    this.hiddenMessage.visible = true;
  }

  isBookOrderCorrect() {
    return this.currentOrder.length === 3 && this.currentOrder.every((color, i) => color === this.bookOrder[i]);
  }
}