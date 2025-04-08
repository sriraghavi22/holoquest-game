// src/controls/mouseControls.js
import * as THREE from 'three';

export class MouseControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isEnabled = true;
        this.clickedObject = null;
        this.hoveredObject = null;
        this.interactableObjects = [];
        
        // Bind methods to maintain 'this' context
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseClick = this.onMouseClick.bind(this);
    }
    
    async init() {
        this.addEventListeners();
        return this;
    }
    
    addEventListeners() {
        if (!this.domElement) {
            console.warn('MouseControls: No DOM element provided for event listeners');
            return;
        }
        
        this.domElement.addEventListener('mousemove', this.onMouseMove);
        this.domElement.addEventListener('click', this.onMouseClick);
    }
    
    setInteractableObjects(objects) {
        this.interactableObjects = Array.isArray(objects) ? objects : [];
    }
    
    onMouseMove(event) {
        if (!this.isEnabled) return;
        
        // Calculate normalized device coordinates
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Cast a ray and check for intersections
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);
        
        if (intersects.length > 0) {
            const object = this.findInteractableParent(intersects[0].object);
            
            if (object && this.hoveredObject !== object) {
                // Mouse entered a new object
                if (this.hoveredObject) {
                    // Dispatch mouse leave on previous object
                    this.dispatchEvent('object:leave', this.hoveredObject);
                }
                
                this.hoveredObject = object;
                // Dispatch mouse enter on new object
                this.dispatchEvent('object:hover', object);
            }
        } else if (this.hoveredObject) {
            // Mouse left all objects
            this.dispatchEvent('object:leave', this.hoveredObject);
            this.hoveredObject = null;
        }
    }
    
    onMouseClick(event) {
        if (!this.isEnabled) return;
        
        // Calculate normalized device coordinates
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Cast a ray and check for intersections
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);
        
        if (intersects.length > 0) {
            const object = this.findInteractableParent(intersects[0].object);
            
            if (object) {
                this.clickedObject = object;
                // Dispatch click event
                this.dispatchEvent('object:click', object);
            }
        }
    }
    
    findInteractableParent(object) {
        // Traverse up the parent chain to find an object marked as interactable
        let current = object;
        
        while (current) {
            if (current.userData && current.userData.interactable) {
                return current;
            }
            current = current.parent;
        }
        
        return null;
    }
    
    dispatchEvent(eventName, object) {
        // You'll need to implement or inject your event system here
        // For now, just use the global event bus if available, or console.log
        if (window.holoQuest && window.holoQuest.eventBus) {
            window.holoQuest.eventBus.emit(eventName, {
                object: object,
                name: object.userData.name || object.name || 'unnamed object',
                type: object.userData.type || 'unknown',
                action: object.userData.action || 'interact with',
                position: object.position.clone(),
                camera: this.camera
            });
        } else {
            console.log(eventName, object);
        }
    }
    
    enable() {
        this.isEnabled = true;
    }
    
    disable() {
        this.isEnabled = false;
        
        // Clear any active hover state
        if (this.hoveredObject) {
            this.dispatchEvent('object:leave', this.hoveredObject);
            this.hoveredObject = null;
        }
    }
    
    update() {
        // Could implement continuous checking here if needed
    }
    
    dispose() {
        if (this.domElement) {
            this.domElement.removeEventListener('mousemove', this.onMouseMove);
            this.domElement.removeEventListener('click', this.onMouseClick);
        }
        
        this.hoveredObject = null;
        this.clickedObject = null;
    }
}