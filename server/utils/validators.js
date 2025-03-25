export function validateMessage(message) {
    if (!message) {
      throw new Error('Message is required');
    }
    
    if (!message.sender || typeof message.sender !== 'string') {
      throw new Error('Invalid sender');
    }
    
    if (!message.recipient || typeof message.recipient !== 'string') {
      throw new Error('Invalid recipient');
    }
    
    if (!message.data || typeof message.data !== 'string') {
      throw new Error('Invalid message data');
    }
    
    if (message.type === 'message' && !message.iv) {
      throw new Error('Missing IV for encrypted message');
    }
  }