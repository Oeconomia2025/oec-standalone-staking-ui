interface LiveCoinWatchCoin {
  code: string;
  rate: number;
  volume: number;
  cap: number | null;
  delta: {
    hour: number | null;
    day: number | null;
    week: number | null;
    month: number | null;
    quarter: number | null;
    year: number | null;
  };
}

class LiveCoinWatchApiService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.livecoinwatch.com';

  constructor() {
    this.apiKey = process.env.LIVE_COIN_WATCH_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('LIVE_COIN_WATCH_API_KEY environment variable is required');
    }
  }

  async getTopCoins(limit: number = 100): Promise<LiveCoinWatchCoin[]> {
    try {
      const response = await fetch(`${this.baseUrl}/coins/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          currency: 'USD',
          sort: 'rank',
          order: 'ascending',
          offset: 0,
          limit: limit,
          meta: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Live Coin Watch API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error fetching data from Live Coin Watch API:', error);
      throw error;
    }
  }
}

export const liveCoinWatchApiService = new LiveCoinWatchApiService();