import axios from 'axios';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { Trade, TradeOutcome } from '../../types/index.js';

export class TradeMonitor {
  private lastProcessedTimestamp: number = 0;
  private processedTradeIds: Set<string> = new Set();
  private marketCategoryCache: Map<string, string> = new Map();

  async initialize(): Promise<void> {
    this.lastProcessedTimestamp = Date.now();
    logger.info(`📊 Monitor initialized at ${new Date(this.lastProcessedTimestamp).toISOString()}`);
    logger.info(`   Will copy trades that occur AFTER this time`);
    logger.info(
      `   Allowed categories: ${config.monitoring.allowedCategories.join(', ') || 'all'}`
    );
  }

  private async fetchTradesFromDataApi(): Promise<Trade[]> {
    try {
      const startSeconds = Math.floor(this.lastProcessedTimestamp / 1000) + 1;
      const response = await axios.get('https://data-api.polymarket.com/activity', {
        params: {
          user: config.targetWallet.toLowerCase(),
          type: 'TRADE',
          limit: 100,
          sortBy: 'TIMESTAMP',
          sortDirection: 'DESC',
          start: startSeconds,
        },
        headers: {
          Accept: 'application/json',
        },
      });

      if (Array.isArray(response.data)) {
        return response.data.map(this.parseDataApiTrade.bind(this));
      }

      return [];
    } catch (error: any) {
      logger.warn(`⚠️  Could not fetch trades: ${error.message || 'Unknown error'}`);
      return [];
    }
  }

  private parseDataApiTrade(apiTrade: any): Trade {
    return {
      txHash: apiTrade.transactionHash || apiTrade.id || `trade-${apiTrade.timestamp}`,
      timestamp: apiTrade.timestamp * 1000,
      market: apiTrade.conditionId || apiTrade.market,
      tokenId: apiTrade.asset,
      side: apiTrade.side.toUpperCase() as 'BUY' | 'SELL',
      price: parseFloat(apiTrade.price),
      size: parseFloat(apiTrade.usdcSize || apiTrade.size),
      outcome: this.normalizeOutcome(apiTrade.outcome),
    };
  }

  private normalizeOutcome(value: any): TradeOutcome {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (normalized === 'YES' || normalized === 'NO') {
      return normalized;
    }
    return 'UNKNOWN';
  }

  private async getMarketCategory(marketId: string): Promise<string | null> {
    if (this.marketCategoryCache.has(marketId)) {
      return this.marketCategoryCache.get(marketId)!;
    }

    try {
      const response = await axios.get(`https://gamma-api.polymarket.com/markets/${marketId}`);
      const category = response.data?.category || null;
      this.marketCategoryCache.set(marketId, category);
      return category;
    } catch (error: any) {
      logger.warn(
        `⚠️  Could not fetch market category for ${marketId}: ${error.message || 'Unknown error'}`
      );
      return null;
    }
  }

  private isAllowedCategory(category: string | null): boolean {
    if (!config.monitoring.allowedCategories.length) return true;
    return (
      category !== null && config.monitoring.allowedCategories.includes(category.toLowerCase())
    );
  }

  async pollForNewTrades(callback: (trade: Trade) => Promise<void>): Promise<void> {
    try {
      const trades = await this.fetchTradesFromDataApi();

      if (trades.length === 0) {
        return;
      }

      const sortedTrades = trades.sort((a, b) => a.timestamp - b.timestamp);

      let newTradesCount = 0;

      for (const trade of sortedTrades) {
        const tradeId = trade.txHash;

        if (this.processedTradeIds.has(tradeId)) {
          continue;
        }

        if (trade.timestamp <= this.lastProcessedTimestamp) {
          continue;
        }

        // Check if market category is allowed
        const category = await this.getMarketCategory(trade.market);
        if (!this.isAllowedCategory(category)) {
          logger.info(
            `🚫 Skipping trade in market ${trade.market} (category: ${category || 'unknown'})`
          );
          continue;
        }

        this.processedTradeIds.add(tradeId);
        this.lastProcessedTimestamp = Math.max(this.lastProcessedTimestamp, trade.timestamp);
        newTradesCount++;

        logger.info(
          `🎯 New trade detected: ${trade.side} ${trade.size} USDC @ ${trade.price.toFixed(3)}`
        );
        logger.info(`   Time: ${new Date(trade.timestamp).toISOString()}`);
        logger.info(`   Category: ${category || 'unknown'}`);
        await callback(trade);
      }

      if (newTradesCount > 0) {
        logger.info(`🔍 Processed ${newTradesCount} new trade(s)`);
      }
    } catch (error: any) {
      logger.error(`❌ Error polling for trades:`, error.message);
    }
  }

  pruneProcessedHashes(): void {
    if (this.processedTradeIds.size > 10000) {
      const entries = Array.from(this.processedTradeIds);
      this.processedTradeIds = new Set(entries.slice(-5000));
    }
  }
}
