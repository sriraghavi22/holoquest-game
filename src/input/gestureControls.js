// src/input/gestureControls.js
import * as handTrack from 'handtrackjs';
import { eventBus } from '../game/eventBus.js';

class GestureControls {
  constructor() {
    this.model = null;
    this.video = null;
    this.isEnabled = false;
    this.lastInteractTime = 0; // Cooldown to prevent spamming
    this.isClosedFistDetected = false; // Track closed fist state
  }

  async init() {
    // Create and append video element
    this.video = document.createElement('video');
    this.video.width = 320;
    this.video.height = 240;
    this.video.style.position = 'absolute';
    this.video.style.bottom = '10px';
    this.video.style.right = '10px';
    this.video.style.border = '1px solid white';
    document.body.appendChild(this.video);

    const modelParams = {
      flipHorizontal: true,
      maxNumBoxes: 1,
      scoreThreshold: 0.8,
    };

    try {
      this.model = await handTrack.load(modelParams);
      console.log('[GestureControls] Model loaded successfully');
    } catch (error) {
      console.error('[GestureControls] Failed to load model:', error);
      this.isEnabled = false; // Disable if model fails
      document.body.removeChild(this.video); // Clean up
      return; // Exit early
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.video.srcObject = stream;
      await this.video.play(); // Ensure video plays
      console.log('[GestureControls] Video stream started');
      this.isEnabled = true;

      this.video.addEventListener('loadeddata', () => {
        console.log('[GestureControls] Video data loaded, starting detection');
        this.runDetection();
      }, { once: true });
    } catch (error) {
      console.error('[GestureControls] Failed to access webcam:', error);
      this.isEnabled = false;
      document.body.removeChild(this.video); // Clean up
    }
  }

  runDetection() {
    if (!this.isEnabled || !this.video || this.video.paused || this.video.ended) {
      console.log('[GestureControls] Detection paused or not enabled');
      return;
    }

    this.model.detect(this.video).then((predictions) => {
      if (predictions.length > 0) {
        const gesture = predictions[0].label;
        const bbox = predictions[0].bbox;
        this.handleGesture(gesture, bbox);
      }
      requestAnimationFrame(() => this.runDetection());
    }).catch((error) => {
      console.error('[GestureControls] Detection error:', error);
      this.isEnabled = false; // Disable on detection failure
    });
  }

  handleGesture(gesture, bbox) {
    console.log('[GestureControls] Detected gesture:', gesture, 'Bounding box:', bbox);
    eventBus.emit('gestureDetected', gesture);

    const now = Date.now();
    const videoWidth = this.video.width;
    const videoHeight = this.video.height;
    const handX = bbox[0] + bbox[2] / 2;
    const handY = bbox[1] + bbox[3] / 2;

    if (gesture === 'open') {
      const normalizedX = handX / videoWidth;
      const normalizedY = handY / videoHeight;

      let directionX = 0;
      let directionZ = 0;
      const speed = 0.1;

      if (normalizedX < 0.4) directionX = -1;
      else if (normalizedX > 0.6) directionX = 1;

      if (normalizedY < 0.4) directionZ = -1;
      else if (normalizedY > 0.6) directionZ = 1;

      if (directionX !== 0 || directionZ !== 0) {
        console.log('[GestureControls] Emitting playerMove:', { directionX, directionZ, speed });
        eventBus.emit('playerMove', { directionX, directionZ, speed });
      }
      this.isClosedFistDetected = false;
    } else if (gesture === 'closed' && now - this.lastInteractTime > 500) {
      console.log('[GestureControls] Closed fist detected, emitting triggerInteraction');
      this.isClosedFistDetected = true;
      eventBus.emit('triggerInteraction');
      this.lastInteractTime = now;
    } else {
      this.isClosedFistDetected = false;
    }
  }

  enable() {
    this.isEnabled = true;
    if (this.video && this.video.paused) this.video.play();
    this.runDetection();
  }

  disable() {
    this.isEnabled = false;
    if (this.video && !this.video.paused) this.video.pause();
  }

  dispose() {
    this.isEnabled = false;
    if (this.video && this.video.srcObject) {
      const tracks = this.video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    if (this.video) {
      document.body.removeChild(this.video);
    }
    this.model = null;
  }
}

export default GestureControls;