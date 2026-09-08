import { config } from '../../config/index.js';
import redisSemanticCache from './redisSemanticCache.js';
import memorySemanticCache from './memorySemanticCache.js';

const drivers = {
  redis: redisSemanticCache,
  memory: memorySemanticCache,
};

const driver = drivers[config.cache.driver];
if (!driver) {
  throw new Error(`Unknown CACHE_DRIVER "${config.cache.driver}"`);
}

export default driver;
