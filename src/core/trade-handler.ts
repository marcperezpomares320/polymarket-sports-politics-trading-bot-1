import type { Trade, BotStats } from '../types/index.js';
import { config } from '../config/index.js';
import { TradeExecutor } from '../services/trader/trade-executor.js';
import { PositionTracker } from '../services/trader/position-tracker.js';
import { RiskManager } from '../services/trader/risk-manager.js';
import { WebSocketMonitor } from '../services/monitor/websocket-monitor.js';
import { logger } from '../utils/logger.js';

export class TradeHandler {
  private executor: TradeExecutor;
  private positions: PositionTracker;
  private risk: RiskManager;
  private wsMonitor?: WebSocketMonitor;
  private processedTrades: Set<string> = new Set();
  private botStartTime: number;
  private stats: BotStats;

  constructor(
    executor: TradeExecutor,
    positions: PositionTracker,
    risk: RiskManager,
    wsMonitor?: WebSocketMonitor,
    botStartTime: number = Date.now()
  ) {
    this.executor = executor;
    this.positions = positions;
    this.risk = risk;
    this.wsMonitor = wsMonitor;
    this.botStartTime = botStartTime;
    this.stats = {
      tradesDetected: 0,
      tradesCopied: 0,
      tradesFailed: 0,
      totalVolume: 0,
    };
  }

  async handleNewTrade(trade: Trade): Promise<void> {
    if (trade.timestamp && trade.timestamp < this.botStartTime) {
      return;
    }

    const tradeKeys = this.getTradeKeys(trade);
    if (tradeKeys.some((key) => this.processedTrades.has(key))) {
      return;
    }

    for (const key of tradeKeys) {
      this.processedTrades.add(key);
    }
    this.pruneProcessedTrades();
    this.stats.tradesDetected++;

    logger.info('\n' + '='.repeat(50));
    logger.info(`🎯 NEW TRADE DETECTED`);
    logger.info(`   Time: ${new Date(trade.timestamp).toISOString()}`);
    logger.info(`   Market: ${trade.market}`);
    logger.info(`   Side: ${trade.side} ${trade.outcome}`);
    logger.info(`   Size: ${trade.size} USDC @ ${trade.price.toFixed(3)}`);
    logger.info(`   Token ID: ${trade.tokenId}`);
    logger.info('='.repeat(50));

    if (trade.side === 'SELL' && !config.trading.copySells) {
      logger.warn('⚠️  Skipping SELL trade (COPY_SELLS=false, BUY-only mode)');
      return;
    }

    const copyNotional = this.executor.calculateCopySize(trade.size);

    if (trade.side === 'SELL') {
      const copyShares = this.executor.calculateSharesForNotional(copyNotional, trade.price);
      const position = this.positions.getPosition(trade.tokenId);
      if (!position || position.shares < copyShares) {
        logger.warn(
          `⚠️  Skipping SELL trade: insufficient position (have ${position?.shares?.toFixed(4) ?? 0}, need ${copyShares.toFixed(4)} shares)`
        );
        return;
      }
    }

    if (this.wsMonitor) {
      await this.wsMonitor.subscribeToMarket(trade.tokenId);
    }

    const riskCheck = this.risk.checkTrade(trade, copyNotional);
    if (!riskCheck.allowed) {
      logger.warn(`⚠️  Risk check blocked trade: ${riskCheck.reason}`);
      return;
    }

    try {
      const result = await this.executor.executeCopyTrade(trade, copyNotional);
      this.risk.recordFill({
        trade,
        notional: result.copyNotional,
        shares: result.copyShares,
        price: result.price,
        side: result.side,
      });
      this.stats.tradesCopied++;
      this.stats.totalVolume += result.copyNotional;
      logger.info(`✅ Successfully copied trade!`);
      logger.info(
        `📊 Session Stats: ${this.stats.tradesCopied}/${this.stats.tradesDetected} copied, ${this.stats.tradesFailed} failed`
      );

      if (config.run.exitAfterFirstSellCopy && result.side === 'SELL') {
        logger.info('\n🎯 EXIT_AFTER_FIRST_SELL_COPY: First SELL copied successfully. Exiting.');
        process.exit(0);
      }
    } catch (error: any) {
      this.stats.tradesFailed++;
      logger.error(`❌ Failed to copy trade`);
      if (error?.message) {
        logger.error(`   Reason: ${error.message}`);
      }
      logger.info(
        `📊 Session Stats: ${this.stats.tradesCopied}/${this.stats.tradesDetected} copied, ${this.stats.tradesFailed} failed`
      );
    }
  }

  getStats(): BotStats {
    return { ...this.stats };
  }

  printStats(): void {
    logger.info('\n📊 Session Statistics:');
    logger.info(`   Trades detected: ${this.stats.tradesDetected}`);
    logger.info(`   Trades copied: ${this.stats.tradesCopied}`);
    logger.info(`   Trades failed: ${this.stats.tradesFailed}`);
    logger.info(`   Total volume: ${this.stats.totalVolume.toFixed(2)} USDC`);
  }

  private getTradeKeys(trade: Trade): string[] {
    const keys: string[] = [];

    if (trade.txHash) {
      keys.push(trade.txHash);
    }

    const fallbackKey = `${trade.tokenId}|${trade.side}|${trade.size}|${trade.price}|${trade.timestamp}`;
    keys.push(fallbackKey);

    return keys;
  }

  private pruneProcessedTrades(): void {
    if (this.processedTrades.size <= 10000) {
      return;
    }

    const entries = Array.from(this.processedTrades);
    this.processedTrades = new Set(entries.slice(-5000));
  }
}
