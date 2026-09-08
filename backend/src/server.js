import 'dotenv/config';
import app from './app.js';
import { config } from './config/index.js';
import { connectDB } from './config/db.js';
import vectorStore from './models/vectorStore/index.js';

async function start() {
  await connectDB();
  await vectorStore.init();
  app.listen(config.port, () => {
    console.log(`Backend listening on port ${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
