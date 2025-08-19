import type { TokenData } from "@shared/schema";

export class CoinGeckoApiService {
  private readonly COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
  private readonly API_KEY = process.env.COINGECKO_API_KEY;

  async getTokenDataByContract(contractAddress: string): Promise<Partial<TokenData> | null> {
    try {
      const url = `${this.COINGECKO_API_URL}/coins/binance-smart-chain/contract/${contractAddress}`;
      const headers: Record<string, string> = {
        'accept': 'application/json',
      };

      if (this.API_KEY) {
        headers['x-cg-demo-api-key'] = this.API_KEY;
      }

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Token not found on CoinGecko: ${contractAddress}`);
          return null;
        }
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.market_data) {
        return null;
      }

      const marketData = data.market_data;

      return {
        name: data.name,
        symbol: data.symbol?.toUpperCase(),
        price: marketData.current_price?.usd || 0,
        priceChange24h: marketData.price_change_24h || 0,
        priceChangePercent24h: marketData.price_change_percentage_24h || 0,
        marketCap: marketData.market_cap?.usd || 0,
        volume24h: marketData.total_volume?.usd || 0,
        totalSupply: marketData.total_supply || 0,
        circulatingSupply: marketData.circulating_supply || 0,
      };
    } catch (error) {
      console.error("Error fetching CoinGecko data:", error);
      return null;
    }
  }

  async getSimplePrice(contractAddress: string): Promise<{ price: number; change24h: number } | null> {
    try {
      const url = `${this.COINGECKO_API_URL}/simple/token_price/binance-smart-chain`;
      const params = new URLSearchParams({
        contract_addresses: contractAddress,
        vs_currencies: 'usd',
        include_24hr_change: 'true',
      });

      const headers: Record<string, string> = {
        'accept': 'application/json',
      };

      if (this.API_KEY) {
        headers['x-cg-demo-api-key'] = this.API_KEY;
      }

      const response = await fetch(`${url}?${params}`, { headers });
      
      if (!response.ok) {
        throw new Error(`CoinGecko simple price API error: ${response.status}`);
      }

      const data = await response.json();
      const tokenData = data[contractAddress.toLowerCase()];

      if (!tokenData) {
        return null;
      }

      return {
        price: tokenData.usd || 0,
        change24h: tokenData.usd_24h_change || 0,
      };
    } catch (error) {
      console.error("Error fetching CoinGecko simple price:", error);
      return null;
    }
  }
}

export const coinGeckoApiService = new CoinGeckoApiService();
