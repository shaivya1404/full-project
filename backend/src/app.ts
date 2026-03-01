import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import routes from './routes';
import errorHandler from './middlewares/error.middleware';
import prisma from './lib/prisma';
import swaggerSpec from './docs/swagger';

// Dashboard routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import campaignsRoutes from './routes/campaigns';
import contactsRoutes from './routes/contacts';
import agentsRoutes from './routes/agents';
import teamsRoutes from './routes/teams';
import ordersRoutes from './routes/orders';
import paymentsRoutes from './routes/payments';
import leadsRoutes from './routes/leads';
import callbacksRoutes from './routes/callbacks';
import inventoryRoutes from './routes/inventory';
import storeRoutes from './routes/store';
import analyticsRoutes from './routes/analytics';
import notificationsRoutes from './routes/notifications';
import smsRoutes from './routes/sms';
import complaintsRoutes from './routes/complaints';
import callsRoutes from './routes/calls';
import liveCallsRoutes from './routes/liveCalls';
import knowledgeBaseRoutes from './routes/knowledgeBase';
import productsRoutes from './routes/products';
import customersRoutes from './routes/customers';
import apiKeysRoutes from './routes/apiKeys';
import searchRoutes from './routes/search';
import exportRoutes from './routes/export';
import bulkRoutes from './routes/bulk';
import faqsRoutes from './routes/faqs';
import webhooksRoutes from './routes/webhooks';
import loyaltyRoutes from './routes/loyalty';
import followUpSequencesRoutes from './routes/followUpSequences';
import objectionsRoutes from './routes/objections';
import complianceRoutes from './routes/compliance';
import recordingsRoutes from './routes/recordings';
import twilioRoutes from './routes/twilio';
import queueRoutes from './routes/queue';
import teamPortalRoutes from './routes/teamPortal';
import fraudRoutes from './routes/fraud';

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'backend-api', db: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', service: 'backend-api', db: 'error', message: (error as Error).message });
  }
});

// TTS/STT v1 routes
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/v1', routes);

// Dashboard routes at /api
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/callbacks', callbacksRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/live-calls', liveCallsRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/faqs', faqsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/follow-up-sequences', followUpSequencesRoutes);
app.use('/api/objections', objectionsRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/team-portal', teamPortalRoutes);
app.use('/api/fraud', fraudRoutes);

// Twilio webhooks (no /api prefix — Twilio calls these directly)
app.use('/twilio', twilioRoutes);

app.use(errorHandler);

export default app;
