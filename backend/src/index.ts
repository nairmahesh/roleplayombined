import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { config } from './config';
import { createApp } from './app';
import { setupSocket } from './socket';

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB: ${config.mongoUri}`);

  const app = createApp();
  const httpServer = http.createServer(app);
  setupSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`PitchIQ backend running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
