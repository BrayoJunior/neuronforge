import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { agentRoutes } from './routes/agents.js';
import { skillRoutes } from './routes/skills.js';
import { marketplaceRoutes } from './routes/marketplace.js';

dotenv.config({ path: '../.env' });

// Prevent unhandled rejections from crashing the server (0G SDK network errors)
process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️ Unhandled rejection (non-fatal):', reason);
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'NeuronForge API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/agents', agentRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/marketplace', marketplaceRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`\n🧠 NeuronForge API running on http://localhost:${PORT}`);
  console.log(`📡 0G Chain RPC: ${process.env.OG_RPC_URL || 'not configured'}`);
  console.log(`💾 0G Storage: ${process.env.OG_STORAGE_INDEXER_RPC || 'not configured'}`);
  console.log(`🤖 0G Compute: ${process.env.OG_COMPUTE_RPC || 'not configured'}\n`);
});

export default app;
