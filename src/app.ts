import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requestId } from '@/middleware/request-id';
import { errorHandler } from '@/middleware/error-handler';
import v1Routes from '@/routes/v1';

const app = express();

// Security headers
app.use(helmet());

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID
app.use(requestId);

// API v1 routes
app.use('/api/v1', v1Routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
