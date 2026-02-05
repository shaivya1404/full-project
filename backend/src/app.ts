import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Request, Response } from 'express';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware, optionalAuth } from './middleware/auth';
import { sanitizeInput } from './middleware/sanitizer';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import apiKeysRoutes from './routes/apiKeys';
import teamsRoutes from './routes/teams';
import callsRoutes from './routes/calls';
import recordingsRoutes from './routes/recordings';
import analyticsRoutes from './routes/analytics';
import statusRoutes from './routes/status';
import testRoutes from './routes/test';
import twilioRoutes from './routes/twilio';
import contactsRoutes from './routes/contacts';
import campaignsRoutes from './routes/campaigns';
import knowledgeBaseRoutes from './routes/knowledgeBase';
import productsRoutes from './routes/products';
import faqsRoutes from './routes/faqs';
import knowledgeIntegrationRoutes from './routes/knowledgeIntegration';
import agentRoutes from './routes/agents';
import queueRoutes from './routes/queue';
import ordersRoutes from './routes/orders';
import customersRoutes from './routes/customers';
import orderAnalyticsRoutes from './routes/orderAnalytics';
import orderBotRoutes from './routes/orderBot';
import paymentsRoutes from './routes/payments';
import teamPortalRoutes from './routes/teamPortal';
import userRoutes from './routes/user';
import liveCallsRoutes from './routes/liveCalls';
import streamRoutes from './routes/stream';
import exportRoutes from './routes/export';
import notificationsRoutes from './routes/notifications';
import searchRoutes from './routes/search';
import bulkRoutes from './routes/bulk';
import webhooksRoutes from './routes/webhooks';
import leadsRoutes from './routes/leads';
import objectionsRoutes from './routes/objections';
import complianceRoutes from './routes/compliance';
import callbacksRoutes from './routes/callbacks';
import inventoryRoutes from './routes/inventory';
import storeRoutes from './routes/store';
// AI Agent feature routes (Phase 1 - Foundation)
import memoryRoutes from './routes/memory';
import conversationStateRoutes from './routes/conversationState';
import transferContextRoutes from './routes/transferContext';
import emotionsRoutes from './routes/emotions';
import apologiesRoutes from './routes/apologies';
// AI Agent feature routes (Phase 2 - Problem Solving)
import problemSolvingRoutes from './routes/problemSolving';
// Real-time notifications
import websocketRoutes from './routes/websocket';
// Campaign follow-up sequences
import followUpSequencesRoutes from './routes/followUpSequences';
// Loyalty & rewards
import loyaltyRoutes from './routes/loyalty';
// SMS notifications
import smsRoutes from './routes/sms';
// Complaint management
import complaintsRoutes from './routes/complaints';
import { KnowledgeBaseRepository } from './db/repositories/knowledgeBaseRepository';
import { ProductRepository } from './db/repositories/productRepository';
import { logger } from './utils/logger';

const app = express();

// Security configuration
app.set('trust proxy', true);

// Helmet security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - production-ready
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://dashboard.yourdomain.com',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-API-Token', 'X-Request-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
  maxAge: 86400, // 24 hours
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware
app.use(sanitizeInput);

app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', apiKeysRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/team', teamPortalRoutes);
app.use('/api/user', userRoutes);
app.use('/api/live-calls', liveCallsRoutes);
app.use('/api/calls/stream', streamRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/test', testRoutes);
app.use('/twilio', twilioRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/products', optionalAuth, productsRoutes);
app.use('/api/faqs', optionalAuth, faqsRoutes);
app.use('/api/knowledge', optionalAuth, knowledgeIntegrationRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/analytics/orders', orderAnalyticsRoutes);
app.use('/api/orders/bot', orderBotRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/webhooks', webhooksRoutes);

// New use case feature routes
app.use('/api/leads', authMiddleware, leadsRoutes);
app.use('/api/objections', authMiddleware, objectionsRoutes);
app.use('/api/compliance', authMiddleware, complianceRoutes);
app.use('/api/callbacks', authMiddleware, callbacksRoutes);
app.use('/api/inventory', authMiddleware, inventoryRoutes);
app.use('/api/store', authMiddleware, storeRoutes);

// AI Agent feature routes (Phase 1 - Foundation)
app.use('/api/memory', authMiddleware, memoryRoutes);
app.use('/api/conversation', authMiddleware, conversationStateRoutes);
app.use('/api/transfer', authMiddleware, transferContextRoutes);
app.use('/api/emotions', authMiddleware, emotionsRoutes);
app.use('/api/apologies', authMiddleware, apologiesRoutes);

// AI Agent feature routes (Phase 2 - Problem Solving)
app.use('/api/problem-solving', authMiddleware, problemSolvingRoutes);

// Real-time WebSocket notifications
app.use('/api/websocket', websocketRoutes);

// Campaign follow-up sequences
app.use('/api/follow-up', authMiddleware, followUpSequencesRoutes);

// Loyalty & rewards
app.use('/api/loyalty', loyaltyRoutes);

// SMS notifications
app.use('/api/sms', smsRoutes);

// Complaint management
app.use('/api/complaints', complaintsRoutes);

// External API endpoint for knowledge search (for WhatsApp, email, chat flows)
app.get('/api/knowledge/search', async (req: Request, res: Response) => {
  try {
    const { q, teamId } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        message: 'Search query is required',
        code: 'QUERY_REQUIRED',
      });
    }

    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      });
    }

    const knowledgeBaseRepository = new KnowledgeBaseRepository();
    const productRepository = new ProductRepository();

    // Search across knowledge base, products, and FAQs
    const [knowledgeResults, productResults, faqResults] = await Promise.all([
      knowledgeBaseRepository.search(q, { teamId }),
      productRepository.searchProducts(q, { teamId }),
      productRepository.searchProductFAQs(q, { teamId }),
    ]);

    // Format results for external consumption
    const formattedResults = {
      knowledgeBase: knowledgeResults.map(kb => ({
        id: kb.id,
        title: kb.title,
        content: kb.content,
        category: kb.category,
        tags: kb.tags ? JSON.parse(kb.tags) : [],
        type: 'knowledge_base',
      })),
      products: productResults.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        details: product.details ? JSON.parse(product.details) : null,
        type: 'product',
      })),
      faqs: faqResults.map(faq => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        type: 'faq',
      })),
    };

    res.status(200).json({
      data: formattedResults,
    });
  } catch (error) {
    logger.error('Error in external knowledge search', error);
    res.status(500).json({
      message: 'Error searching knowledge',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });
  }
});

app.use(errorHandler);

export default app;
