# Language & Welcome Message Configuration Guide

## What's New ✨

You can now configure your bot to respond in **English or Hindi** with **custom welcome messages**.

---

## Quick Start

### Change to English (Default)
Already set! All templates now have:
- Language: `en` (English)
- Welcome: `Hello! Thank you for calling. How can I assist you today?`

### Change to Hindi
Add this to your environment or API call:
```typescript
// In your call initialization
language: 'hi'  // Activates Hindi template
```

---

## Features Added

### 1. Language Support

| Language | Code | Status |
|----------|------|--------|
| English | `en` | ✅ Full Support |
| Hindi | `hi` | ✅ Full Support |

### 2. Custom Welcome Messages

Each template now includes a greeting that's sent automatically:

**English Examples:**
- Customer Support: "Hello! Thank you for calling. How can I assist you today?"
- Sales Agent: "Hi! Welcome. I'm here to help you find the perfect product. What interests you today?"
- Technical Support: "Welcome to technical support. Please describe the issue you're experiencing."
- Order Status: "Hi! I can help you track your order. What's your order number?"

**Hindi Example:**
- "नमस्ते! आपको कैसे मदद कर सकते हैं?" (Hello! How can I help you?)

### 3. Language Enforcement

The system prompts now explicitly instruct the bot:
```
⭐ IMPORTANT: Always respond in ENGLISH only. Do not translate or use any other language.
```

This ensures the bot doesn't switch languages mid-conversation.

---

## How It Works

### 1. When a Call Starts
```
Caller dials
    ↓
WebSocket connects
    ↓
System loads template (English or Hindi)
    ↓
Welcome message embedded in system prompt
    ↓
Bot greeting sent automatically
    ↓
🔊 Caller hears: "Hello! Thank you for calling..."
```

### 2. Throughout the Call
```
User asks question
    ↓
System prompt includes language instruction
    ↓
Bot responds in configured language ONLY
    ↓
Never switches languages
```

---

## Configuration Options

### Option 1: Template ID
```typescript
// Uses specific template (automatically English)
templateId: 'customer-support'  // English
templateId: 'sales-agent'        // English
templateId: 'technical-support'  // English
templateId: 'order-status'       // English
templateId: 'customer-support-hi' // Hindi
```

### Option 2: Language Parameter
```typescript
// In campaign or call initialization
language: 'en'  // English templates
language: 'hi'  // Hindi templates
```

---

## Modifying Welcome Messages

### To Change the Welcome for a Specific Language

Edit `src/services/promptService.ts`:

**English Customer Support (Line ~45):**
```typescript
welcomeMessage: 'Hello! Thank you for calling. How can I assist you today?',
```

Change to:
```typescript
welcomeMessage: 'Welcome to our service center!',
```

**Hindi (Line ~120):**
```typescript
welcomeMessage: 'नमस्ते! आपको कैसे मदद कर सकते हैं?',
```

Change to:
```typescript
welcomeMessage: 'स्वागत है!',
```

### Rebuild After Changes
```bash
npm run build
npm start
```

---

## Adding More Languages

To add a new language (e.g., Spanish):

### Step 1: Add Language Variant Templates

```typescript
// In promptService.ts, after hindiTemplates

private readonly spanishTemplates: SystemPromptTemplate[] = [
  {
    id: 'customer-support-es',
    name: 'Customer Support Agent (Spanish)',
    description: 'Customer support agent that responds in Spanish',
    role: 'customer support agent',
    tone: 'professional, helpful, and empathetic',
    knowledgeInjection: true,
    confidenceThreshold: 0.5,
    language: 'es',
    welcomeMessage: '¡Hola! ¿Cómo puedo ayudarte?',
    basePrompt: `Eres un agente de soporte profesional...
    
⭐ IMPORTANTE: Siempre responde SOLO en ESPAÑOL. No traduzcas.
...`
  }
];
```

### Step 2: Update getAvailableTemplates()

```typescript
getAvailableTemplates(language?: string): SystemPromptTemplate[] {
  if (language === 'hi') return this.hindiTemplates;
  if (language === 'es') return this.spanishTemplates;  // NEW
  return this.defaultTemplates;
}
```

### Step 3: Update getTemplateById()

```typescript
getTemplateById(templateId: string, language?: string): SystemPromptTemplate {
  if (language === 'hi' && this.hindiTemplates.length > 0) {
    const template = this.hindiTemplates.find(...);
    if (template) return template;
  }
  if (language === 'es' && this.spanishTemplates.length > 0) {  // NEW
    const template = this.spanishTemplates.find(...);
    if (template) return template;
  }
  const template = this.defaultTemplates.find(...);
  if (!template) throw new Error(`Template not found: ${templateId}`);
  return template;
}
```

### Step 4: Rebuild
```bash
npm run build
npm start
```

---

## API Usage Examples

### Initialize Call with English
```bash
curl -X POST http://localhost:3000/api/calls/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "language": "en",
    "templateId": "customer-support"
  }'
```

### Initialize Call with Hindi
```bash
curl -X POST http://localhost:3000/api/calls/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919876543210",
    "language": "hi",
    "templateId": "customer-support-hi"
  }'
```

---

## Testing the Changes

### Test English Greeting
1. Run: `npm start`
2. Make a call
3. Listen for: "Hello! Thank you for calling. How can I assist you today?"
4. Ask a question
5. Bot responds in English ✅

### Test Hindi Greeting
1. Set `language: 'hi'` in your call
2. Run: `npm start`
3. Make a call
4. Listen for: "नमस्ते! आपको कैसे मदद कर सकते हैं?"
5. Bot responds in Hindi ✅

---

## Key System Prompt Changes

### What Was Added to Every Prompt

**English:**
```
⭐ IMPORTANT: Always respond in ENGLISH only. 
   Do not translate or use any other language.
```

**Hindi:**
```
⭐ महत्वपूर्ण: हमेशा केवल HINDI में जवाब दें। 
   अन्य किसी भी भाषा का उपयोग न करें।
```

### Welcome Message Injection

All prompts now include:
```
📞 INITIAL GREETING: When the call starts, begin with 
   exactly this greeting: "Hello! Thank you for calling..."
```

---

## Troubleshooting

### Bot Still Speaking Spanish/Another Language?

**Problem**: Bot doesn't respect language setting
**Solution**:
1. Check system prompt includes language instruction
2. Verify `⭐ IMPORTANT` line is in the prompt
3. Check OpenAI response for language markers
4. Run `npm run build` to ensure changes applied

### Welcome Message Not Used?

**Problem**: Bot doesn't say the custom welcome
**Solution**:
1. Check `welcomeMessage` field in template
2. Verify prompt includes "📞 INITIAL GREETING"
3. Check logs for greeting trigger
4. Test with `npm start` and make new call

### Build Fails?

**Problem**: TypeScript compilation errors
**Solution**:
```bash
npm run build 2>&1 | head -30  # See first errors
npm run build 2>&1 | grep -A 5 "error TS"  # Find specific errors
```

---

## Summary of Changes

| Component | Change | Impact |
|-----------|--------|--------|
| **SystemPromptTemplate Interface** | Added `language?` and `welcomeMessage?` fields | Can now track language and custom greetings |
| **System Prompts** | Added language enforcement instructions | Bot won't switch languages mid-call |
| **Welcome Messages** | Added default welcome for each template | Custom greetings on call start |
| **Hindi Templates** | New `hindiTemplates` array | Hindi language support ✅ |
| **buildSystemPrompt()** | Injects welcome message into prompt | Greeting sent automatically |
| **getAvailableTemplates()** | Checks language parameter | Can return Hindi templates |
| **getTemplateById()** | Supports language parameter | Can find language-specific templates |

---

## Next Steps

1. **Build and test**: `npm run build && npm start`
2. **Make test calls**: Verify English and Hindi greetings
3. **Add more languages**: Follow the Spanish example above
4. **Deploy**: Push changes to production

---

**Status**: ✅ Language support enabled
**Supported**: English (en), Hindi (hi)
**Easy to extend**: Add more languages in same format

