import { TradeMonitor } from '../services/monitor/trade-monitor.js';

describe('TradeMonitor', () => {
  let monitor: TradeMonitor;

  beforeEach(() => {
    monitor = new TradeMonitor();
  });

  it('should initialize', async () => {
    await expect(monitor.initialize()).resolves.not.toThrow();
  });
});