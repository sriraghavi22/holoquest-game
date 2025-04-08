// src/utils/loader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AssetLoader {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.gltfLoader = new GLTFLoader();
        this.audioLoader = new THREE.AudioLoader();
        
        // For tracking load progress
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
    }
    
    setCallbacks(onProgress, onComplete) {
        this.onProgressCallback = onProgress;
        this.onCompleteCallback = onComplete;
    }
    
    // Load multiple assets at once
    loadAssets(assets) {
        return new Promise((resolve) => {
            const result = {};
            this.totalAssets = Object.keys(assets).length;
            this.loadedAssets = 0;
            
            const checkComplete = () => {
                this.loadedAssets++;
                
                if (this.onProgressCallback) {
                    const progress = this.loadedAssets / this.totalAssets;
                    this.onProgressCallback(progress);
                }
                
                if (this.loadedAssets === this.totalAssets) {
                    if (this.onCompleteCallback) {
                        this.onCompleteCallback();
                    }
                    resolve(result);
                }
            };
            
            // Process each asset based on type
            for (const [key, asset] of Object.entries(assets)) {
                switch (asset.type) {
                    case 'texture':
                        this.loadTexture(asset.url)
                            .then(texture => {
                                result[key] = texture;
                                checkComplete();
                            });
                        break;
                    case 'model':
                        this.loadModel(asset.url)
                            .then(model => {
                                result[key] = model;
                                checkComplete();
                            });
                        break;
                    case 'audio':
                        this.loadAudio(asset.url)
                            .then(audio => {
                                result[key] = audio;
                                checkComplete();
                            });
                        break;
                    default:
                        console.error(`Unknown asset type: ${asset.type}`);
                        checkComplete();
                }
            }
        });
    }
    
    // Load a single texture
    loadTexture(url) {
        return new Promise((resolve) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error(`Error loading texture from ${url}:`, error);
                    resolve(null); // Resolve with null to avoid blocking the chain
                }
            );
        });
    }
    
    // Load a 3D model
    loadModel(url) {
        return new Promise((resolve) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    resolve(gltf);
                },
                undefined,
                (error) => {
                    console.error(`Error loading model from ${url}:`, error);
                    resolve(null);
                }
            );
        });
    }
    
    // Load audio file
    loadAudio(url) {
        return new Promise((resolve) => {
            this.audioLoader.load(
                url,
                (buffer) => {
                    resolve(buffer);
                },
                undefined,
                (error) => {
                    console.error(`Error loading audio from ${url}:`, error);
                    resolve(null);
                }
            );
        });
    }
}