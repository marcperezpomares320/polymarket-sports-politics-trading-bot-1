export type TradeOutcome = 'YES' | 'NO' | 'UNKNOWN';

export interface Trade {
  txHash: string;
  timestamp: number;
  market: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  outcome: TradeOutcome;
}

export interface CopyExecutionResult {
  orderId: string;
  copyNotional: number;
  copyShares: number;
  price: number;
  side: 'BUY' | 'SELL';
  tokenId: string;
}

export interface PositionState {
  tokenId: string;
  market: string;
  outcome: string;
  shares: number;
  notional: number;
  avgPrice: number;
  lastUpdated: number;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export type WsChannel = 'market' | 'user';

export interface WsAuth {
  apiKey: string;
  secret: string;
  passphrase: string;
}

export interface BotStats {
  tradesDetected: number;
  tradesCopied: number;
  tradesFailed: number;
  totalVolume: number;
}

export interface Config {
  targetWallet: string;
  privateKey: string;
  polymarketGeoToken: string;
  rpcUrl: string;
  chainId: number;
  contracts: {
    exchange: string;
    ctf: string;
    usdc: string;
    negRiskAdapter: string;
    negRiskExchange: string;
  };
  trading: {
    positionSizeMultiplier: number;
    maxTradeSize: number;
    minTradeSize: number;
    slippageTolerance: number;
    orderType: 'LIMIT' | 'FOK' | 'FAK';
    copySells: boolean;
  };
  risk: {
    maxSessionNotional: number;
    maxPerMarketNotional: number;
  };
  run: {
    exitAfterFirstSellCopy: boolean;
  };
  monitoring: {
    pollInterval: number;
    useWebSocket: boolean;
    useUserChannel: boolean;
    wsAssetIds: string[];
    wsMarketIds: string[];
    allowedCategories: string[];
  };
}
