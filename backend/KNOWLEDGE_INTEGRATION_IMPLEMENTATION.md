# Knowledge Base and Product Database Integration with OpenAI Realtime API

## Overview

This implementation integrates a comprehensive knowledge base and product database with the OpenAI Realtime API to enhance AI bot responses with contextual product knowledge and information.

## Features Implemented

### 1. Knowledge Integration Service (`KnowledgeService`)
- **Semantic Search**: Searches across knowledge base, products, and FAQs
- **Context Retrieval**: Gets relevant knowledge based on conversation context
- **Confidence Scoring**: Calculates confidence scores for AI responses
- **Usage Tracking**: Records which knowledge sources were referenced
- **Fallback Detection**: Identifies when questions are outside knowledge scope

### 2. AI Prompt Enhancement (`PromptService`)
- **Dynamic System Prompts**: Generates context-aware prompts with injected knowledge
- **Role-based Templates**: Supports different agent types (customer support, sales, technical support)
- **Campaign Customization**: Allows custom prompts for specific campaigns
- **Knowledge Injection**: Seamlessly integrates relevant knowledge into prompts

### 3. Real-time Knowledge Retrieval
- **Live Context Updates**: Updates knowledge context during calls based on customer queries
- **Source Reference Tracking**: Identifies which knowledge sources were used in responses
- **Relevance Scoring**: Ranks knowledge by relevance to current conversation

### 4. Confidence Scoring System
- **Multi-factor Scoring**: Considers knowledge coverage, source relevance, and response certainty
- **Threshold-based Fallback**: Triggers human agent transfer for low-confidence responses
- **Analytics Integration**: Tracks confidence metrics for performance analysis

### 5. Knowledge Fallback System
- **Scope Detection**: Identifies when questions are outside knowledge base
- **Graceful Degradation**: Provides helpful "I don't know" responses
- **Unanswered Question Tracking**: Records questions for future knowledge base updates
- **Human Agent Transfer Logic**: Seamless escalation when needed

### 6. API Endpoints

#### Knowledge Context Management
- `POST /api/calls/:id/knowledge-context` - Get knowledge context for a call
- `GET /api/calls/:id/knowledge-used` - Get knowledge referenced in call
- `POST /api/knowledge-base/relevant-search` - Search for relevant knowledge
- `POST /api/calls/:id/initialize-knowledge` - Initialize knowledge for call

#### Campaign Management
- `PATCH /api/campaigns/:id/system-prompt` - Update campaign AI prompt
- `GET /api/campaigns/:id/system-prompt` - Get campaign prompt
- `GET /api/knowledge-base/templates` - Get available prompt templates

#### Analytics and Monitoring
- `GET /api/knowledge-base/unanswered-questions` - Get unanswered questions
- `GET /api/knowledge-base/analytics` - Get knowledge usage analytics
- `POST /api/knowledge-base/confidence-score` - Calculate confidence score
- `POST /api/knowledge-base/track-unanswered` - Track unanswered question

### 7. Integration Points

#### CallManager Enhancement
- **Knowledge Context Initialization**: Sets up knowledge context when starting calls
- **Real-time Updates**: Updates conversation knowledge based on customer queries
- **Fallback Detection**: Checks if responses should trigger human agent transfer

#### OpenAI Realtime Integration
- **Dynamic Prompt Updates**: Updates system prompts with new knowledge context
- **Response Analysis**: Analyzes AI responses for knowledge source usage
- **Confidence Tracking**: Calculates confidence scores for all responses

#### Twilio Integration
- **Inbound Call Knowledge**: Initializes knowledge context for incoming calls
- **Outbound Campaign Support**: Supports knowledge-enhanced outbound campaigns

### 8. Configuration Management

#### Team-scoped Knowledge Access
- Multi-tenant architecture with team-based knowledge isolation
- Role-based access control for knowledge management
- Campaign-specific knowledge base assignments

#### Prompt Template System
- **Pre-built Templates**: Customer support, sales, technical support, order status
- **Custom Templates**: Create campaign-specific prompts
- **Version Control**: Track changes to knowledge base and prompts

## Database Schema Updates

### New Models Added
- `KnowledgeBaseSource` - Tracks knowledge usage per call
- `UnansweredQuestion` - Stores questions outside knowledge scope
- Enhanced `Call` model with `teamId` for multi-tenancy
- Enhanced `Campaign` model with script support

### Repository Extensions
- `CallRepository`: Added knowledge tracking methods
- `KnowledgeBaseRepository`: Enhanced search capabilities
- `ProductRepository`: Product and FAQ search methods

## Usage Examples

### Initialize Knowledge Context for Call
```typescript
const callManager = new CallManager();
await callManager.startCall(
  'stream_123', 
  '+1234567890', 
  undefined, // callSid
  'team_abc', // teamId
  'campaign_123', // campaignId
  'customer-support' // templateId
);
```

### Search Relevant Knowledge
```typescript
const knowledgeService = new KnowledgeService();
const results = await knowledgeService.searchRelevantKnowledge(
  'pricing plans for enterprise',
  'team_abc',
  5 // limit
);
```

### Generate Dynamic Prompt
```typescript
const promptService = new PromptService();
const dynamicPrompt = await promptService.generateDynamicPrompt(
  'call_123',
  'team_abc',
  'campaign_123',
  'sales-agent'
);
```

### Track Knowledge Usage
```typescript
await knowledgeService.recordKnowledgeUsage('call_123', [
  { type: 'knowledge', id: 'kb_123', relevanceScore: 0.9 },
  { type: 'product', id: 'prod_456', relevanceScore: 0.8 }
]);
```

## Testing

### Comprehensive Test Suite
- **Unit Tests**: Individual service testing with mocked dependencies
- **Integration Tests**: End-to-end knowledge flow testing
- **Fallback Testing**: Response confidence and fallback scenarios
- **Knowledge Search Testing**: Search relevance and accuracy

### Test Coverage
- Knowledge service semantic search
- Prompt generation with context injection
- Confidence score calculations
- Fallback detection logic
- API endpoint functionality

## Performance Considerations

### Caching Strategy
- Knowledge context caching per call session
- Prompt template caching for frequent reuse
- Search result caching for common queries

### Scalability
- Efficient database queries with proper indexing
- Batch processing for knowledge analytics
- Async processing for confidence score calculations

## Security

### Access Control
- Team-based knowledge isolation
- API key authentication for external access
- Rate limiting on knowledge search endpoints

### Data Privacy
- Knowledge usage logging for audit trails
- Secure handling of customer conversation data
- Compliance with data retention policies

## Future Enhancements

### Advanced Features
- **Vector Embeddings**: Semantic search using vector databases
- **Machine Learning**: Automated knowledge base expansion
- **Multi-language Support**: Localized knowledge bases
- **Real-time Learning**: Dynamic knowledge base updates

### Analytics Improvements
- **Performance Metrics**: Knowledge base effectiveness tracking
- **User Satisfaction**: Correlation with knowledge usage
- **Automated Insights**: AI-powered knowledge gap detection

## Deployment Notes

### Environment Variables
- `OPENAI_API_KEY`: Required for OpenAI Realtime API
- `DATABASE_URL`: SQLite database connection
- `RECORDING_STORAGE_PATH`: Audio recording storage directory

### Database Migrations
- Run `npm run db:migrate` to apply schema changes
- Seed knowledge base with initial data using `npm run seed`

### Configuration
- Configure team settings for knowledge base access
- Set up campaign-specific knowledge contexts
- Define confidence thresholds for fallback behavior

This implementation provides a robust foundation for knowledge-enhanced AI conversations, with comprehensive tracking, analytics, and fallback mechanisms to ensure high-quality customer interactions.