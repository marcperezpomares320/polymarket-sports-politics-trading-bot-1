import { PolymarketCopyBot } from './core/bot.js';
import { logger } from './utils/logger.js';

async function main() {
  const bot = new PolymarketCopyBot();

  process.on('SIGINT', () => {
    logger.info('\n\nReceived SIGINT, shutting down...');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    bot.stop();
    process.exit(0);
  });

  try {
    await bot.initialize();
    await bot.start();
  } catch (error) {
    logger.fatal('Fatal error:', String(error));
    process.exit(1);
  }
}

main();
