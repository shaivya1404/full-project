import { OrderService, OrderItemInput, CreateOrderRequest, ValidationResult, OrderConfirmation } from './orderService';
import { CallRepository } from '../db/repositories/callRepository';
import { logger } from '../utils/logger';

export interface OrderCollectionState {
  step: 'idle' | 'collecting_items' | 'confirming_items' | 'collecting_address' | 'collecting_contact' | 'confirming_order' | 'complete';
  items: OrderItemInput[];
  customerName?: string;
  phone?: string;
  email?: string;
  deliveryAddress?: string;
  notes?: string;
  specialInstructions?: string;
  validationErrors: string[];
  warnings: string[];
  confirmedItems: boolean;
}

export interface BotOrderPrompt {
  prompt: string;
  field: string;
  validate?: (value: string) => boolean;
  errorMessage?: string;
}

export class OrderCollectionService {
  private orderService: OrderService;
  private callRepository: CallRepository;
  private orderStates: Map<string, OrderCollectionState>;

  constructor() {
    this.orderService = new OrderService();
    this.callRepository = new CallRepository();
    this.orderStates = new Map();
  }

  // State Management

  getOrCreateState(streamSid: string): OrderCollectionState {
    if (!this.orderStates.has(streamSid)) {
      this.orderStates.set(streamSid, {
        step: 'idle',
        items: [],
        validationErrors: [],
        warnings: [],
        confirmedItems: false,
      });
    }
    return this.orderStates.get(streamSid)!;
  }

  updateState(streamSid: string, updates: Partial<OrderCollectionState>): void {
    const state = this.getOrCreateState(streamSid);
    Object.assign(state, updates);
    this.orderStates.set(streamSid, state);
  }

  clearState(streamSid: string): void {
    this.orderStates.delete(streamSid);
  }

  getState(streamSid: string): OrderCollectionState | undefined {
    return this.orderStates.get(streamSid);
  }

  // Bot Conversation Prompts

  getNextPrompt(streamSid: string): BotOrderPrompt | null {
    const state = this.getOrCreateState(streamSid);

    switch (state.step) {
      case 'idle':
        return {
          prompt: "Welcome! I'll help you place an order today. What would you like to order? You can browse our menu or tell me what you're craving.",
          field: 'items',
        };

      case 'collecting_items':
        return {
          prompt: "What else would you like to add to your order? Or say 'that's all' to proceed to delivery details.",
          field: 'items',
        };

      case 'confirming_items':
        return {
          prompt: `I've noted: ${state.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}. Would you like to add anything else, or shall I proceed with delivery?`,
          field: 'confirm_items',
        };

      case 'collecting_address':
        return {
          prompt: "What is your delivery address? Please include street address, city, and any special directions.",
          field: 'address',
        };

      case 'collecting_contact':
        return {
          prompt: "What phone number can we reach you at for order updates? You can also provide an email for a receipt.",
          field: 'contact',
        };

      case 'confirming_order':
        return {
          prompt: `Here's your order summary:\n${this.formatOrderSummary(state)}\nWould you like me to place this order? Please confirm with 'yes' or 'no'.`,
          field: 'confirm_order',
        };

      case 'complete':
        return null;

      default:
        return null;
    }
  }

  formatOrderSummary(state: OrderCollectionState): string {
    const items = state.items.map(i => `• ${i.quantity}x ${i.productName} - $${(i.unitPrice * i.quantity).toFixed(2)}`);
    const total = state.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    
    let summary = items.join('\n');
    summary += `\n\nTotal: $${total.toFixed(2)}`;
    
    if (state.deliveryAddress) {
      summary += `\nDelivery to: ${state.deliveryAddress}`;
    }
    
    if (state.phone) {
      summary += `\nContact: ${state.phone}`;
    }
    
    if (state.specialInstructions) {
      summary += `\nNotes: ${state.specialInstructions}`;
    }
    
    return summary;
  }

  // Process User Input

  async processInput(streamSid: string, input: string, isAgent: boolean = false): Promise<{
    response: string;
    state: OrderCollectionState;
    orderCreated?: boolean;
    orderId?: string;
    orderNumber?: string;
  }> {
    const state = this.getOrCreateState(streamSid);
    const inputLower = input.toLowerCase().trim();

    // Handle common responses
    if (['no', 'nope', 'negative', 'cancel'].includes(inputLower)) {
      if (state.step === 'confirming_items') {
        this.updateState(streamSid, {
          step: 'collecting_items',
          confirmedItems: true,
        });
        return {
          response: "Got it. What else would you like to add?",
          state,
        };
      }
      if (state.step === 'confirming_order') {
        this.clearState(streamSid);
        return {
          response: "No problem! Your order has been cancelled. Is there anything else I can help you with?",
          state: { ...state, step: 'idle' },
        };
      }
    }

    if (['yes', 'yeah', 'yep', 'confirm', 'place order'].includes(inputLower)) {
      if (state.step === 'confirming_items' || (state.step === 'collecting_items' && state.confirmedItems)) {
        this.updateState(streamSid, { step: 'collecting_address' });
        return {
          response: "Great! Now I need your delivery address.",
          state,
        };
      }
      if (state.step === 'confirming_order') {
        return this.finalizeOrder(streamSid);
      }
    }

    if (['thats all', 'that\'s all', 'nothing else', 'no more', 'done', 'complete'].includes(inputLower)) {
      if (state.step === 'collecting_items') {
        if (state.items.length === 0) {
          return {
            response: "You haven't added any items yet. What would you like to order?",
            state,
          };
        }
        this.updateState(streamSid, { step: 'collecting_address' });
        return {
          response: "Got it! Now I need your delivery address.",
          state,
        };
      }
    }

    // Process based on current step
    switch (state.step) {
      case 'idle':
      case 'collecting_items':
        return this.processItemInput(streamSid, input, state);

      case 'collecting_address':
        return this.processAddressInput(streamSid, input, state);

      case 'collecting_contact':
        return this.processContactInput(streamSid, input, state);

      default:
        return {
          response: "I didn't understand that. Could you please clarify?",
          state,
        };
    }
  }

  private processItemInput(streamSid: string, input: string, state: OrderCollectionState): Promise<{
    response: string;
    state: OrderCollectionState;
  }> {
    // Try to extract order items from input
    const extractedItems = this.extractItemsFromInput(input);

    if (extractedItems.length > 0) {
      const newItems = [...state.items, ...extractedItems];
      this.updateState(streamSid, {
        items: newItems,
        step: 'collecting_items',
      });

      const itemList = extractedItems.map(i => `${i.quantity}x ${i.productName}`).join(', ');
      return Promise.resolve({
        response: `Added: ${itemList}. What else would you like?`,
        state: this.getState(streamSid)!,
      });
    }

    // If no items extracted, prompt again
    return Promise.resolve({
      response: "I didn't catch that. Could you please tell me what you'd like to order? For example, 'I'd like a pepperoni pizza and a Coke'.",
      state,
    });
  }

  private extractItemsFromInput(input: string): OrderItemInput[] {
    const items: OrderItemInput[] = [];
    const inputLower = input.toLowerCase();

    // Pattern for quantity + item
    const quantityPattern = /(\d+)\s*(?:x|of|pieces?|orders?)?\s*([a-zA-Z\s]+)/gi;
    let match;

    while ((match = quantityPattern.exec(input)) !== null) {
      const quantity = parseInt(match[1]);
      const productName = match[2].trim();

      if (quantity > 0 && productName.length > 2) {
        items.push({
          productName,
          quantity,
          unitPrice: 0, // Would be looked up from menu
        });
      }
    }

    // Pattern for "I'd like / can I get" without explicit quantity
    if (items.length === 0) {
      const phrasePattern = /(?:I'd like|can I get|can you add|order|get|have|want|need)\s*(?:a|an)?\s*([a-zA-Z\s]+)/gi;
      while ((match = phrasePattern.exec(input)) !== null) {
        let productName = match[1].trim();
        
        // Remove common filler words
        productName = productName.replace(/^(pizza |burger |sandwich |salad |drink |side )/gi, '$1');
        
        if (productName.length > 2 && !productName.includes('please')) {
          items.push({
            productName,
            quantity: 1,
            unitPrice: 0,
          });
        }
      }
    }

    return items;
  }

  private processAddressInput(streamSid: string, input: string, state: OrderCollectionState): Promise<{
    response: string;
    state: OrderCollectionState;
  }> {
    const address = input.trim();
    
    // Basic validation
    if (address.length < 10) {
      return Promise.resolve({
        response: "That address seems a bit short. Could you please provide a complete delivery address including street and city?",
        state,
      });
    }

    this.updateState(streamSid, {
      deliveryAddress: address,
      step: 'collecting_contact',
    });

    return Promise.resolve({
      response: "Got it! What phone number can we reach you at for order updates?",
      state: this.getState(streamSid)!,
    });
  }

  private processContactInput(streamSid: string, input: string, state: OrderCollectionState): Promise<{
    response: string;
    state: OrderCollectionState;
  }> {
    const phoneRegex = /(\+?[\d\s\-()]{10,})/;
    const emailRegex = /([^\s@]+@[^\s@]+\.[^\s@]+)/;

    const phoneMatch = input.match(phoneRegex);
    const emailMatch = input.match(emailRegex);

    if (phoneMatch) {
      this.updateState(streamSid, {
        phone: phoneMatch[1].trim(),
        email: emailMatch ? emailMatch[1].trim() : state.email,
        step: 'confirming_order',
      });

      return Promise.resolve({
        response: this.formatOrderSummary(this.getState(streamSid)!) + "\n\nIs this correct? Please confirm with 'yes' to place your order.",
        state: this.getState(streamSid)!,
      });
    }

    if (emailMatch) {
      this.updateState(streamSid, {
        email: emailMatch[1].trim(),
        step: 'confirming_order',
      });

      return Promise.resolve({
        response: this.formatOrderSummary(this.getState(streamSid)!) + "\n\nIs this correct? Please confirm with 'yes' to place your order.",
        state: this.getState(streamSid)!,
      });
    }

    return Promise.resolve({
      response: "I didn't catch a valid phone number. Could you please provide your phone number for order updates?",
      state,
    });
  }

  private async finalizeOrder(streamSid: string): Promise<{
    response: string;
    state: OrderCollectionState;
    orderCreated: boolean;
    orderId?: string;
    orderNumber?: string;
  }> {
    const state = this.getOrCreateState(streamSid);

    try {
      const request: CreateOrderRequest = {
        items: state.items,
        deliveryAddress: state.deliveryAddress,
        phone: state.phone,
        email: state.email,
        customerName: state.customerName,
        notes: state.notes,
        specialInstructions: state.specialInstructions,
      };

      const result = await this.orderService.createOrder(request);

      if (!result.order) {
        this.updateState(streamSid, {
          validationErrors: result.validation.errors,
          step: 'confirming_order',
        });

        return {
          response: `I couldn't process your order. Please check the following issues:\n${result.validation.errors.join('\n')}`,
          state: this.getState(streamSid)!,
          orderCreated: false,
        };
      }

      this.updateState(streamSid, { step: 'complete' });

      return {
        response: `Thank you! Your order has been placed successfully.\n\nOrder Number: ${result.order.orderNumber}\nTotal: $${result.order.totalAmount.toFixed(2)}\nEstimated delivery: 30-45 minutes\n\nYou'll receive updates at ${state.phone || state.email}.`,
        state: this.getState(streamSid)!,
        orderCreated: true,
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
      };
    } catch (error) {
      logger.error('Error finalizing order', error);
      return {
        response: "I'm sorry, but I encountered an error placing your order. Let me try again or connect you with a team member.",
        state,
        orderCreated: false,
      };
    }
  }

  // Integration with Call Manager

  async createOrderFromCall(
    streamSid: string,
    callId: string,
    teamId?: string,
    campaignId?: string,
  ): Promise<{
    success: boolean;
    order?: any;
    error?: string;
  }> {
    try {
      const call = await this.callRepository.getCallById(callId);
      if (!call) {
        return { success: false, error: 'Call not found' };
      }

      // Get transcripts to extract customer data
      const transcripts = await this.callRepository.getRecentTranscripts(callId, 20);
      const transcriptText = transcripts.map(t => t.text).join(' ');

      // Extract data from transcript
      const customerData = this.orderService.extractCustomerDataFromTranscript(transcriptText);
      const items = this.orderService.extractOrderItemsFromTranscript(transcriptText);

      if (items.length === 0) {
        return { success: false, error: 'No order items found in transcript' };
      }

      // Calculate prices (in production, would look up from menu)
      const itemsWithPrices = items.map(item => ({
        ...item,
        unitPrice: this.estimatePrice(item.productName),
      }));

      // Create the order
      const result = await this.orderService.createOrder({
        teamId,
        campaignId,
        callId,
        items: itemsWithPrices,
        deliveryAddress: customerData.address,
        phone: customerData.phone,
        email: customerData.email,
        customerName: customerData.name,
      });

      if (!result.order) {
        return {
          success: false,
          error: result.validation.errors.join('; '),
        };
      }

      logger.info(`Order ${result.order.orderNumber} created from call ${callId}`);

      return {
        success: true,
        order: result.order,
      };
    } catch (error) {
      logger.error('Error creating order from call', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private estimatePrice(productName: string): number {
    const name = productName.toLowerCase();
    
    // Price estimation based on keywords
    if (name.includes('pizza')) return 15.99;
    if (name.includes('burger')) return 11.99;
    if (name.includes('fries') || name.includes('sides')) return 4.99;
    if (name.includes('drink') || name.includes('soda')) return 2.99;
    if (name.includes('salad')) return 9.99;
    if (name.includes('sandwich')) return 8.99;
    if (name.includes('pasta')) return 12.99;
    if (name.includes('wings')) return 10.99;
    if (name.includes('chicken')) return 14.99;
    if (name.includes('steak')) return 22.99;
    if (name.includes('fish') || name.includes('seafood')) return 18.99;
    
    return 10.00; // Default price
  }

  // Session cleanup

  cleanupSession(streamSid: string): void {
    this.clearState(streamSid);
    logger.info(`Order collection session cleaned up for streamSid: ${streamSid}`);
  }
}

export const getOrderCollectionService = (): OrderCollectionService => {
  return new OrderCollectionService();
};
