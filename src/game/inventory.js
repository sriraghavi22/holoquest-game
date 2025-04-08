import { eventBus } from './eventBus';

class Inventory {
  constructor() {
    this.items = [];
    this.maxItems = 10;
    
    // Set up event listeners
    this.setupEventListeners();
  }

  init() {
    return this;
  }

  setupEventListeners() {
    eventBus.on('collectItem', data => this.addItem(data));
    eventBus.on('useItem', itemId => this.useItem(itemId));
    eventBus.on('combineItems', data => this.combineItems(data.item1, data.item2));
  }

  addItem(itemData) {
    if (this.items.length >= this.maxItems) {
      eventBus.emit('showMessage', 'Your inventory is full!');
      return false;
    }
    
    // Check if item already exists
    const existingItemIndex = this.items.findIndex(item => item.id === itemData.id);
    
    if (existingItemIndex >= 0) {
      // Update existing item if it supports quantity
      if (this.items[existingItemIndex].quantity !== undefined) {
        this.items[existingItemIndex].quantity += itemData.quantity || 1;
        eventBus.emit('inventoryUpdated', this.getItems());
        return true;
      } else {
        eventBus.emit('showMessage', `You already have ${itemData.name}.`);
        return false;
      }
    }
    
    // Add new item
    this.items.push({
      id: itemData.id,
      name: itemData.name,
      description: itemData.description,
      quantity: itemData.quantity || 1,
      icon: itemData.icon || null,
      usable: itemData.usable !== undefined ? itemData.usable : true,
      combinable: itemData.combinable !== undefined ? itemData.combinable : false,
      combinableWith: itemData.combinableWith || []
    });
    
    eventBus.emit('showMessage', `Added ${itemData.name} to inventory.`);
    eventBus.emit('inventoryUpdated', this.getItems());
    
    return true;
  }

  removeItem(itemId, quantity = 1) {
    const index = this.items.findIndex(item => item.id === itemId);
    
    if (index === -1) {
      return false;
    }
    
    if (this.items[index].quantity > quantity) {
      this.items[index].quantity -= quantity;
    } else {
      this.items.splice(index, 1);
    }
    
    eventBus.emit('inventoryUpdated', this.getItems());
    return true;
  }

  hasItem(itemId) {
    return this.items.some(item => item.id === itemId);
  }

  getItem(itemId) {
    return this.items.find(item => item.id === itemId) || null;
  }

  getItems() {
    return [...this.items];
  }

  useItem(itemId) {
    const item = this.getItem(itemId);
    
    if (!item) {
      eventBus.emit('showMessage', 'Item not found.');
      return false;
    }
    
    if (!item.usable) {
      eventBus.emit('showMessage', `${item.name} cannot be used directly.`);
      return false;
    }
    
    // Emit event that the item is being used
    eventBus.emit('itemUsed', item);
    
    // If the item is consumable (like a health potion), remove it after use
    if (item.consumable) {
      this.removeItem(itemId, 1);
    }
    
    return true;
  }

  combineItems(itemId1, itemId2) {
    const item1 = this.getItem(itemId1);
    const item2 = this.getItem(itemId2);
    
    if (!item1 || !item2) {
      eventBus.emit('showMessage', 'One or both items not found.');
      return false;
    }
    
    if (!item1.combinable || !item2.combinable) {
      eventBus.emit('showMessage', 'These items cannot be combined.');
      return false;
    }
    
    // Check if items can be combined with each other
    if (!item1.combinableWith.includes(itemId2) && 
        !item2.combinableWith.includes(itemId1)) {
      eventBus.emit('showMessage', 'These specific items cannot be combined together.');
      return false;
    }
    
    // Emit event with both items
    eventBus.emit('itemsCombined', { item1, item2 });
    
    // The actual combination result should be handled by a puzzle or game logic
    // This just handles the inventory part
    
    return true;
  }

  clearInventory() {
    this.items = [];
    eventBus.emit('inventoryUpdated', this.getItems());
  }

  saveInventory() {
    localStorage.setItem('holoquest_inventory', JSON.stringify(this.items));
  }

  loadInventory() {
    const savedInventory = localStorage.getItem('holoquest_inventory');
    
    if (savedInventory) {
      try {
        this.items = JSON.parse(savedInventory);
        eventBus.emit('inventoryUpdated', this.getItems());
        return true;
      } catch (error) {
        console.error('Error loading inventory:', error);
        return false;
      }
    }
    
    return false;
  }
}

// Export a singleton instance
const inventory = new Inventory();
export { inventory };