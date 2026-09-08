import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// CORS_ORIGIN may be a single URL or a comma-separated list (e.g. prod + local dev).
const allowedOrigins = config.corsOrigin.split(',').map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins.length > 1 ? allowedOrigins : allowedOrigins[0] }));
app.use(express.json());

app.use('/api', routes);

// Future phases: auth middleware, tenant_id derivation, ingestion/retrieval/generation routes

app.use(errorHandler);

export default app;
