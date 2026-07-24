/**
 * 外匯即時連動服務 (Exchange Rate Service)
 * 支援多幣別 (CNY, USD, JPY, EUR, TWD) 轉換與 LocalStorage 快取機制
 */

const DEFAULT_RATES = {
  USD: 1.0,
  TWD: 32.5,
  CNY: 7.25, // 人民幣對美元 (1 USD = 7.25 CNY -> 1 CNY ≈ 4.48 TWD)
  JPY: 155.0,
  EUR: 0.92
};

const CACHE_KEY = 'archery_catalog_exchange_rates_v1';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 快取 6 小時

class ExchangeRateService {
  constructor() {
    this.rates = DEFAULT_RATES;
    this.lastUpdated = Date.now();
    this.loadFromCache();
  }

  loadFromCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.lastUpdated < CACHE_DURATION) {
          this.rates = parsed.rates;
          this.lastUpdated = parsed.lastUpdated;
        }
      }
    } catch (e) {
      console.warn('Failed to load exchange rates cache', e);
    }
  }

  saveToCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        rates: this.rates,
        lastUpdated: this.lastUpdated
      }));
    } catch (e) {
      console.warn('Failed to save exchange rates cache', e);
    }
  }

  /**
   * 根據基礎貨幣與目標貨幣，換算最終價格
   * @param {number} amount 原始金額
   * @param {string} fromCurrency 原始幣別 (e.g. 'USD', 'CNY', 'JPY')
   * @param {string} toCurrency 目標幣別 (e.g. 'TWD', 'USD', 'CNY')
   * @param {number} markupFactor 利潤/運費加成率 (預設 1.0)
   */
  convertPrice(amount, fromCurrency = 'USD', toCurrency = 'TWD', markupFactor = 1.0) {
    if (!amount || isNaN(amount)) return 0;

    const fromRate = this.rates[fromCurrency] || 1.0;
    const toRate = this.rates[toCurrency] || 1.0;

    // 先轉為 USD 再轉為目標貨幣
    const amountInUSD = amount / fromRate;
    const converted = amountInUSD * toRate * markupFactor;

    return Math.round(converted * 100) / 100;
  }

  /**
   * 格式化貨幣顯示
   */
  formatCurrency(amount, currency = 'TWD') {
    const symbols = {
      TWD: 'NT$',
      USD: '$',
      CNY: '￥',
      JPY: '¥',
      EUR: '€'
    };

    const symbol = symbols[currency] || '$';
    const formattedAmount = currency === 'TWD' || currency === 'JPY'
      ? Math.round(amount).toLocaleString()
      : amount.toFixed(2);

    return `${symbol} ${formattedAmount}`;
  }

  /**
   * 手動一鍵刷定/更新最新匯率 (模擬 API 同步)
   */
  async refreshRates() {
    // 模擬稍微波動的真實外匯 API 數據
    this.rates = {
      USD: 1.0,
      TWD: 32.4 + (Math.random() * 0.3 - 0.15),
      CNY: 7.24 + (Math.random() * 0.04 - 0.02),
      JPY: 154.8 + (Math.random() * 0.8 - 0.4),
      EUR: 0.92
    };
    this.lastUpdated = Date.now();
    this.saveToCache();
    return this.rates;
  }
}

export const exchangeRateService = new ExchangeRateService();
