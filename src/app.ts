import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Request, Response } from 'express';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
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
import { KnowledgeBaseRepository } from './db/repositories/knowledgeBaseRepository';
import { ProductRepository } from './db/repositories/productRepository';
import { logger } from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', apiKeysRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/test', testRoutes);
app.use('/twilio', twilioRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/faqs', faqsRoutes);
app.use('/api/knowledge', knowledgeIntegrationRoutes);

// External API endpoint for knowledge search (for WhatsApp, email, chat flows)
app.get('/api/knowledge/search', authMiddleware, async (req: Request, res: Response) => {
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
