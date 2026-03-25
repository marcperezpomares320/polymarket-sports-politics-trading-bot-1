import { config, validateConfig } from '../config/index.js';
import { TradeMonitor } from '../services/monitor/trade-monitor.js';
import { WebSocketMonitor } from '../services/monitor/websocket-monitor.js';
import { TradeExecutor } from '../services/trader/trade-executor.js';
import { PositionTracker } from '../services/trader/position-tracker.js';
import { RiskManager } from '../services/trader/risk-manager.js';
import { TradeHandler } from './trade-handler.js';
import { logger } from '../utils/logger.js';

export class PolymarketCopyBot {
  private monitor: TradeMonitor;
  private wsMonitor?: WebSocketMonitor;
  private executor: TradeExecutor;
  private positions: PositionTracker;
  private risk: RiskManager;
  private tradeHandler: TradeHandler;
  private isRunning: boolean = false;
  private botStartTime: number = 0;

  constructor() {
    validateConfig();

    this.monitor = new TradeMonitor();
    this.executor = new TradeExecutor();
    this.positions = new PositionTracker();
    this.risk = new RiskManager(this.positions);
    this.tradeHandler = new TradeHandler(this.executor, this.positions, this.risk);
  }

  async initialize(): Promise<void> {
    logger.info('🤖 Polymarket Sports & Politics Trading Bot');
    logger.info('================================');
    logger.info(`Target wallet: ${config.targetWallet}`);
    logger.info(`Position multiplier: ${config.trading.positionSizeMultiplier * 100}%`);
    logger.info(`Max trade size: ${config.trading.maxTradeSize} USDC`);
    logger.info(`Order type: ${config.trading.orderType}`);
    logger.info(`Copy sells: ${config.trading.copySells ? 'Yes' : 'No (BUY only)'}`);
    logger.info(`WebSocket: ${config.monitoring.useWebSocket ? 'Enabled' : 'Disabled'}`);
    if (config.monitoring.allowedCategories.length > 0) {
      logger.info(`Allowed categories: ${config.monitoring.allowedCategories.join(', ')}`);
    } else {
      logger.info(`Allowed categories: all`);
    }
    if (config.risk.maxSessionNotional > 0 || config.risk.maxPerMarketNotional > 0) {
      logger.info(
        `Risk caps: session=${config.risk.maxSessionNotional || '∞'} USDC, per-market=${config.risk.maxPerMarketNotional || '∞'} USDC`
      );
    }
    logger.info(`Auth mode: EOA (signature type 0)`);
    logger.info('================================\n');

    this.botStartTime = Date.now();
    logger.info(`⏰ Bot start time: ${new Date(this.botStartTime).toISOString()}`);
    logger.info('   (Only trades after this time will be copied)\n');

    await this.monitor.initialize();
    await this.executor.initialize();
    await this.reconcilePositions();

    if (config.monitoring.useWebSocket) {
      this.wsMonitor = new WebSocketMonitor();
      this.tradeHandler = new TradeHandler(
        this.executor,
        this.positions,
        this.risk,
        this.wsMonitor,
        this.botStartTime
      );

      try {
        const wsAuth = this.executor.getWsAuth();
        const channel = config.monitoring.useUserChannel ? 'user' : 'market';
        await this.wsMonitor.initialize(
          this.tradeHandler.handleNewTrade.bind(this.tradeHandler),
          channel,
          wsAuth
        );
        logger.info(`✅ WebSocket monitor initialized (${channel} channel)\n`);

        if (channel === 'market' && config.monitoring.wsAssetIds.length > 0) {
          for (const assetId of config.monitoring.wsAssetIds) {
            await this.wsMonitor.subscribeToMarket(assetId);
          }
        }

        if (channel === 'user' && config.monitoring.wsMarketIds.length > 0) {
          for (const marketId of config.monitoring.wsMarketIds) {
            await this.wsMonitor.subscribeToCondition(marketId);
          }
        }
      } catch (error) {
        logger.error('⚠️  WebSocket initialization failed, falling back to REST API only');
        logger.error('   Error:', String(error));
        this.wsMonitor = undefined;
        this.tradeHandler = new TradeHandler(
          this.executor,
          this.positions,
          this.risk,
          undefined,
          this.botStartTime
        );
      }
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;
    const monitoringMethods = [];
    if (this.wsMonitor) monitoringMethods.push('WebSocket');
    monitoringMethods.push('REST API');

    logger.info(`🚀 Bot started! Monitoring via: ${monitoringMethods.join(' + ')}\n`);

    while (this.isRunning) {
      try {
        await this.monitor.pollForNewTrades(
          this.tradeHandler.handleNewTrade.bind(this.tradeHandler)
        );
        this.monitor.pruneProcessedHashes();
      } catch (error) {
        logger.error('Error in monitoring loop:', String(error));
      }

      await this.sleep(config.monitoring.pollInterval);
    }
  }

  stop(): void {
    this.isRunning = false;

    if (this.wsMonitor) {
      this.wsMonitor.close();
    }

    logger.info('\n🛑 Bot stopped');
    this.tradeHandler.printStats();
  }

  private async reconcilePositions(): Promise<void> {
    try {
      const positions = await this.executor.getPositions();
      if (!positions || positions.length === 0) {
        logger.info('🧾 Positions: none found (fresh session)');
        return;
      }

      const { loaded, skipped } = this.positions.loadFromClobPositions(positions);
      const totalNotional = this.positions.getTotalNotional();
      logger.info(
        `🧾 Positions loaded: ${loaded} (skipped ${skipped}), total notional ≈ ${totalNotional.toFixed(2)} USDC`
      );
    } catch (error: any) {
      logger.warn(`🧾 Positions reconciliation failed: ${error.message || 'Unknown error'}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
