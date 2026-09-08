import dns from 'node:dns';
import mongoose from 'mongoose';
import { config } from './index.js';

export async function connectDB(uri = config.mongodb.uri) {
  try {
    await mongoose.connect(uri);
  } catch (err) {
    // Some networks (common on Windows / certain ISPs) can't resolve the SRV
    // record a mongodb+srv:// URI needs via the OS-configured DNS server.
    // Retry once against a public resolver before giving up.
    if (err.message?.includes('querySrv') && uri.startsWith('mongodb+srv://')) {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      await mongoose.connect(uri);
    } else {
      throw err;
    }
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
