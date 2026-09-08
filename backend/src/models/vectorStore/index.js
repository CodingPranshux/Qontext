import { config } from '../../config/index.js';
import pgVectorStore from './pgVectorStore.js';
import memoryVectorStore from './memoryVectorStore.js';

const drivers = {
  pgvector: pgVectorStore,
  memory: memoryVectorStore,
};

const driver = drivers[config.vectorStore.driver];
if (!driver) {
  throw new Error(`Unknown VECTOR_STORE_DRIVER "${config.vectorStore.driver}"`);
}

export default driver;
