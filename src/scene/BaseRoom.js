import * as THREE from 'three';
import { TextureLoader } from 'three';

export class BaseRoom extends THREE.Object3D {
  constructor(scene) {
    super();
    this.scene = scene;
    this.objects = [];
    this.interactiveObjects = [];
    this.textureLoader = new TextureLoader();
    
    this.roomSize = { width: 20, height: 10, depth: 20 };
    this.wallThickness = 0.5;
  }

  async init() {
    await this.createRoom();
    await this.addFurniture();
    await this.addInteractiveObjects();
    return this;
  }

  async createRoom() {
    // Floor
    const floorTexture = await this.loadTexture('/assets/textures/wall.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(8, 8);
    const floorGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      map: floorTexture,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.add(floor);

    // Ceiling
    const ceilingTexture = await this.loadTexture('/assets/textures/wall.jpg');
    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    ceilingTexture.repeat.set(4, 4);
    const ceilingGeometry = new THREE.PlaneGeometry(this.roomSize.width, this.roomSize.depth);
    const ceilingMaterial = new THREE.MeshStandardMaterial({ 
      map: ceilingTexture,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.roomSize.height;
    this.add(ceiling);

    // Walls
    const wallTexture = await this.loadTexture('/assets/textures/wall.jpg');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(4, 2);
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      map: wallTexture,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const wallConfigs = [
      { geometry: new THREE.BoxGeometry(this.roomSize.width, this.roomSize.height, this.wallThickness), position: { x: 0, y: this.roomSize.height / 2, z: -this.roomSize.depth / 2 } }, // Back
      { geometry: new THREE.BoxGeometry(this.wallThickness, this.roomSize.height, this.roomSize.depth), position: { x: -this.roomSize.width / 2, y: this.roomSize.height / 2, z: 0 } }, // Left
      { geometry: new THREE.BoxGeometry(this.wallThickness, this.roomSize.height, this.roomSize.depth), position: { x: this.roomSize.width / 2, y: this.roomSize.height / 2, z: 0 } }  // Right
    ];

    wallConfigs.forEach(config => {
      const wall = new THREE.Mesh(config.geometry, wallMaterial);
      wall.position.set(config.position.x, config.position.y, config.position.z);
      this.add(wall);
    });
  }

  async addFurniture() {
    console.log('BaseRoom: No furniture added (override in subclass)');
  }

  async addInteractiveObjects() {
    console.log('BaseRoom: No interactive objects added (override in subclass)');
  }

  makeObjectInteractive(object, data) {
    object.userData = { ...object.userData, ...data, isInteractive: true };
    this.interactiveObjects.push(object);
  }

  loadTexture(path) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => resolve(texture),
        undefined,
        (error) => {
          console.error(`Error loading texture ${path}:`, error);
          resolve(this.createFallbackTexture());
        }
      );
    });
  }

  createFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#AAAAAA';
    context.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }

  getInteractiveObjects() {
    return this.interactiveObjects;
  }

  getAllObjects() {
    return this.objects.concat(this.interactiveObjects);
  }
}