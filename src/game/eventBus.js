//src/game/eventBus.js
class EventBus {
  constructor() {
    this.events = {};
  }
  
  // Subscribe to an event
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
    
    // Return an unsubscribe function
    return () => {
      this.off(eventName, callback);
    };
  }
  
  // Unsubscribe from an event
  off(eventName, callback) {
    if (!this.events[eventName]) {
      return;
    }
    
    this.events[eventName] = this.events[eventName].filter(
      cb => cb !== callback
    );
    
    // Clean up empty event arrays
    if (this.events[eventName].length === 0) {
      delete this.events[eventName];
    }
  }
  
  // Emit an event with data
  emit(eventName, data = {}) {
    if (!this.events[eventName]) {
      return;
    }
    
    // Add a timestamp to the event data
    const eventData = {
      ...data,
      _timestamp: Date.now()
    };
    
    // Call all registered callbacks with the data
    this.events[eventName].forEach(callback => {
      try {
        callback(eventData);
      } catch (error) {
        console.error(`Error in event handler for "${eventName}":`, error);
      }
    });
  }
  
  // Add publish as an alias for emit to fix compatibility with SceneManager
  publish(eventName, data = {}) {
    return this.emit(eventName, data);
  }
  
  // Subscribe to an event once
  once(eventName, callback) {
    const onceCallback = (data) => {
      callback(data);
      this.off(eventName, onceCallback);
    };
    
    this.on(eventName, onceCallback);
    
    // Return an unsubscribe function
    return () => {
      this.off(eventName, onceCallback);
    };
  }
  
  // Clear all event subscriptions
  clear() {
    this.events = {};
  }
  
  // Get a list of all registered event names
  getEventNames() {
    return Object.keys(this.events);
  }
  
  // Get the count of subscribers for a specific event
  getSubscriberCount(eventName) {
    if (!this.events[eventName]) {
      return 0;
    }
    return this.events[eventName].length;
  }
}

// Export a singleton instance
const eventBus = new EventBus();
export { eventBus };