import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health';
import callsRoutes from './routes/calls';
import analyticsRoutes from './routes/analytics';
import statusRoutes from './routes/status';
import twilioRoutes from './routes/twilio';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/status', statusRoutes);
app.use('/twilio', twilioRoutes);

app.use(errorHandler);

export default app;
