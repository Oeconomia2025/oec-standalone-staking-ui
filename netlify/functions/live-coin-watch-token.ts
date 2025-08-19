import type { Handler } from '@netlify/functions';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

export const handler: Handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  try {
    // Extract token code from query parameters or path
    const tokenCode = event.queryStringParameters?.token || event.path.split('/').pop();
    
    if (!tokenCode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Token code is required' }),
      };
    }

    // Fetch token data from database
    const [tokenData] = await db
      .select()
      .from(schema.liveCoinWatchCoins)
      .where(eq(schema.liveCoinWatchCoins.code, tokenCode))
      .limit(1);

    if (!tokenData) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: `Token ${tokenCode} not found` }),
      };
    }

    // Contract address mapping for BSC network
    const getContractAddress = (code: string): string => {
      const contracts: Record<string, string> = {
        'ETH': '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
        'BTC': '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
        'USDT': '0x55d398326f99059ff775485246999027b3197955',
        'BNB': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        'USDC': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        'XRP': '0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe',
        'ADA': '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47',
        'DOGE': '0xba2ae424d960c26247dd6c32edc70b295c744c43',
        'LINK': '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd',
        'DOT': '0x7083609fce4d1d8dc0c979aab8c869ea2c873402',
        'LTC': '0x4338665cbb7b2485a8855a139b75d5e34ab0db94',
        'CAKE': '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82'
      };
      return contracts[code] || `dynamic-${code.toLowerCase()}`;
    };

    // Transform database data to match expected API format
    const response = {
      id: getContractAddress(tokenData.code),
      code: tokenData.code,
      name: tokenData.name,
      symbol: tokenData.code,
      contractAddress: getContractAddress(tokenData.code),
      network: 'BSC',
      price: tokenData.rate,
      priceChange24h: tokenData.deltaDay ? (tokenData.rate * (tokenData.deltaDay - 1)) : 0,
      priceChangePercent24h: tokenData.deltaDay ? ((tokenData.deltaDay - 1) * 100) : 0,
      marketCap: tokenData.cap || 0,
      volume24h: tokenData.volume || 0,
      totalSupply: tokenData.totalSupply || 0,
      circulatingSupply: tokenData.circulatingSupply || 0,
      liquidity: 0,
      txCount24h: 0,
      lastUpdated: tokenData.lastUpdated?.toISOString() || new Date().toISOString(),
      logo: `https://s2.coinmarketcap.com/static/img/coins/32x32/${tokenData.code === 'BTC' ? '1' : tokenData.code === 'ETH' ? '1027' : '52'}.png`,
      website: tokenData.code === 'BTC' ? 'https://bitcoin.org/' : tokenData.code === 'ETH' ? 'https://ethereum.org/' : undefined,
      deltaHour: tokenData.deltaHour || 1,
      deltaWeek: tokenData.deltaWeek || 1,
      deltaMonth: tokenData.deltaMonth || 1,
      deltaQuarter: tokenData.deltaQuarter || 1,
      deltaYear: tokenData.deltaYear || 1,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error fetching Live Coin Watch token data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: 'Failed to fetch token data',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};