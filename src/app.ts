import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
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

app.use(errorHandler);

export default app;
