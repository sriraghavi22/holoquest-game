// uimanager.js
import { eventBus } from '../game/eventBus.js';

class UIManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.uiContainer = null;
    this.interactionHint = null;
    this.inventoryDisplay = null;
    this.messageDisplay = null;
    this.readablePanel = null;
    this.closeButton = null;
    this.isReadableOpen = false;
  }

  init() {
    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'ui-container';
    this.uiContainer.style.position = 'absolute';
    this.uiContainer.style.top = '0';
    this.uiContainer.style.left = '0';
    this.uiContainer.style.width = '100%';
    this.uiContainer.style.height = '100%';
    this.uiContainer.style.pointerEvents = 'none';
    document.body.appendChild(this.uiContainer);

    this.interactionHint = document.createElement('div');
    this.interactionHint.id = 'interaction-hint';
    this.interactionHint.style.position = 'absolute';
    this.interactionHint.style.background = 'rgba(0, 0, 51, 0.8)';
    this.interactionHint.style.color = '#FFD700';
    this.interactionHint.style.padding = '8px 15px';
    this.interactionHint.style.borderRadius = '5px';
    this.interactionHint.style.fontSize = '16px';
    this.interactionHint.style.fontFamily = 'Georgia, serif';
    this.interactionHint.style.zIndex = '1000';
    this.interactionHint.style.transition = 'opacity 0.3s ease-in-out';
    this.interactionHint.style.opacity = '0';
    this.interactionHint.style.pointerEvents = 'none';
    this.uiContainer.appendChild(this.interactionHint);

    this.inventoryDisplay = document.createElement('div');
    this.inventoryDisplay.id = 'inventory-display';
    this.inventoryDisplay.style.position = 'absolute';
    this.inventoryDisplay.style.bottom = '10px';
    this.inventoryDisplay.style.right = '10px';
    this.inventoryDisplay.style.background = 'rgba(0, 0, 51, 0.7)';
    this.inventoryDisplay.style.padding = '10px';
    this.inventoryDisplay.style.color = '#FFD700';
    this.inventoryDisplay.style.border = '2px solid #FFD700';
    this.inventoryDisplay.style.borderRadius = '5px';
    this.uiContainer.appendChild(this.inventoryDisplay);

    this.messageDisplay = document.createElement('div');
    this.messageDisplay.id = 'message-display';
    this.messageDisplay.style.position = 'absolute';
    this.messageDisplay.style.bottom = '20px';
    this.messageDisplay.style.left = '50%';
    this.messageDisplay.style.transform = 'translateX(-50%)';
    this.messageDisplay.style.background = 'rgba(0, 0, 51, 0.8)';
    this.messageDisplay.style.color = '#FFD700';
    this.messageDisplay.style.padding = '12px 24px';
    this.messageDisplay.style.borderRadius = '8px';
    this.messageDisplay.style.fontSize = '18px';
    this.messageDisplay.style.fontFamily = 'Georgia, serif';
    this.messageDisplay.style.zIndex = '1000';
    this.messageDisplay.style.transition = 'opacity 0.3s ease-in-out';
    this.messageDisplay.style.opacity = '0';
    this.messageDisplay.style.pointerEvents = 'none';
    this.uiContainer.appendChild(this.messageDisplay);

    this.readablePanel = document.createElement('div');
    this.readablePanel.id = 'readable-panel';
    this.readablePanel.style.position = 'absolute';
    this.readablePanel.style.top = '50%';
    this.readablePanel.style.left = '50%';
    this.readablePanel.style.transform = 'translate(-50%, -50%)';
    this.readablePanel.style.background = 'rgba(139, 69, 19, 0.9)';
    this.readablePanel.style.color = '#FFD700';
    this.readablePanel.style.padding = '25px';
    this.readablePanel.style.borderRadius = '12px';
    this.readablePanel.style.maxWidth = '450px';
    this.readablePanel.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.6)';
    this.readablePanel.style.fontFamily = 'Georgia, serif';
    this.readablePanel.style.zIndex = '2000';
    this.readablePanel.style.pointerEvents = 'auto';
    this.readablePanel.style.transition = 'opacity 0.3s ease-in-out';
    this.readablePanel.style.opacity = '0';
    this.uiContainer.appendChild(this.readablePanel);

    this.closeButton = document.createElement('button');
    this.closeButton.className = 'close-button';
    this.closeButton.textContent = 'Close';
    this.closeButton.style.position = 'absolute';
    this.closeButton.style.top = '10px';
    this.closeButton.style.right = '10px';
    this.closeButton.style.padding = '8px 15px';
    this.closeButton.style.background = '#8B4513';
    this.closeButton.style.color = 'white';
    this.closeButton.style.border = 'none';
    this.closeButton.style.borderRadius = '5px';
    this.closeButton.style.cursor = 'pointer';
    this.closeButton.style.pointerEvents = 'auto';
    this.closeButton.style.display = 'none';
    this.closeButton.addEventListener('click', () => {
      this.hideReadable();
    });
    this.readablePanel.appendChild(this.closeButton);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'e' && this.isReadableOpen) {
        this.hideReadable();
      }
    });

    this.eventBus.on('object:hover', this.showInteractionHint.bind(this));
    this.eventBus.on('object:leave', this.hideInteractionHint.bind(this));
    this.eventBus.on('inventory:updated', this.updateInventoryDisplay.bind(this));
    this.eventBus.on('showMessage', this.showMessage.bind(this));
    this.eventBus.on('showReadable', this.showReadable.bind(this));

    console.log('UI Manager initialized');
    return this;
  }

  showInteractionHint(data) {
    if (!data || !data.action) {
      console.warn('Invalid hover data:', data);
      return;
    }
    if (!this.interactionHint) {
      console.error('Interaction hint element not initialized');
      return;
    }

    this.interactionHint.textContent = data.action;
    this.interactionHint.style.opacity = '1';
    if (data.position && data.camera) {
      const vector = data.position.clone().project(data.camera);
      const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
      this.interactionHint.style.left = `${x}px`;
      this.interactionHint.style.top = `${y - 40}px`;
    } else {
      this.interactionHint.style.left = '50%';
      this.interactionHint.style.top = '20%';
      this.interactionHint.style.transform = 'translateX(-50%)';
    }

    clearTimeout(this.hintTimeout);
    this.hintTimeout = setTimeout(() => {
      this.interactionHint.style.opacity = '0';
    }, 2000);
  }

  hideInteractionHint() {
    if (!this.interactionHint) return;
    this.interactionHint.style.opacity = '0';
    clearTimeout(this.hintTimeout);
  }

  updateInventoryDisplay(inventory) {
    if (!this.inventoryDisplay) return;
    this.inventoryDisplay.innerHTML = '<strong>Inventory:</strong><br>';
    if (!inventory || !inventory.items) return;
    inventory.items.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'inventory-item';
      itemElement.textContent = item.name;
      itemElement.style.padding = '5px';
      itemElement.style.cursor = 'pointer';
      itemElement.addEventListener('click', () => {
        this.eventBus.emit('inventory:select', item);
      });
      this.inventoryDisplay.appendChild(itemElement);
    });
  }

  showMessage(message) {
    if (!this.messageDisplay) return;

    let displayText = '';
    
    if (typeof message === 'string') {
      displayText = message;
    } else if (typeof message === 'object') {
      if (message.text) {
        displayText = message.text;
      } else if (Array.isArray(message)) {
        displayText = message.join('');
      } else {
        const filteredMessage = {};
        Object.entries(message).forEach(([key, value]) => {
          if (!key.includes('timestamp')) {
            filteredMessage[key] = value;
          }
        });
        displayText = Object.values(filteredMessage)
          .filter(val => typeof val === 'string' || typeof val === 'number')
          .join('');
      }
    }

    if (!displayText) {
      console.warn('Invalid message format:', message);
      return;
    }

    console.log('Showing message:', displayText);
    this.messageDisplay.textContent = displayText;
    this.messageDisplay.style.opacity = '1';
    
    clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => {
      this.messageDisplay.style.opacity = '0';
    }, 4000);
  }

  showReadable(data) {
    if (!this.readablePanel || !this.closeButton) return;
    this.readablePanel.innerHTML = '';

    const content = document.createElement('div');
    content.textContent = data.text;
    content.style.padding = '15px';
    content.style.fontSize = '18px';
    content.style.lineHeight = '1.6';
    this.readablePanel.appendChild(content);

    this.readablePanel.appendChild(this.closeButton);
    this.closeButton.style.display = 'block';

    this.readablePanel.style.opacity = '1';
    this.isReadableOpen = true;
  }

  hideReadable() {
    if (!this.readablePanel || !this.closeButton) return;
    this.readablePanel.style.opacity = '0';
    setTimeout(() => {
      this.readablePanel.innerHTML = '';
      this.closeButton.style.display = 'none';
      this.isReadableOpen = false;
    }, 300);
  }

  update(delta) {
    this.time += delta || 0;
    const bobOffset = Math.sin(this.time) * 5;
    if (this.companionOrb) {
      this.companionOrb.style.transform = `translateY(${bobOffset}px)`;
    }
  }

  hideAll() {
    this.hideReadable();
    this.hideInteractionHint();
    if (this.messageDisplay) {
      this.messageDisplay.style.opacity = '0';
    }
  }
}

export { UIManager };