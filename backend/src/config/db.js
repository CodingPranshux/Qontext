import mongoose from 'mongoose';
import { config } from './index.js';

export async function connectDB(uri = config.mongodb.uri) {
  await mongoose.connect(uri);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
