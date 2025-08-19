import type { Handler } from '@netlify/functions';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

export const handler: Handler = async (event, context) => {
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
    // Extract contract address and timeframe from query parameters
    const contractAddress = event.queryStringParameters?.contract;
    const timeframe = event.queryStringParameters?.timeframe || '1D';
    
    if (!contractAddress) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Contract address is required' }),
      };
    }

    // Try to get real historical data from database first
    const historicalData = await db
      .select()
      .from(schema.priceHistoryData)
      .where(and(
        eq(schema.priceHistoryData.contractAddress, contractAddress.toLowerCase()),
        eq(schema.priceHistoryData.timeframe, timeframe)
      ))
      .orderBy(schema.priceHistoryData.timestamp);

    if (historicalData.length > 0) {
      // Use real historical data
      const priceHistory = historicalData.map(point => ({
        timestamp: point.timestamp,
        price: point.price,
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(priceHistory),
      };
    }

    // Fallback: Generate realistic price history using current Live Coin Watch prices
    const generatePriceHistory = async (contractAddress: string, timeframe: string) => {
      const normalizedAddress = contractAddress.toLowerCase();
      let currentPrice = 100; // fallback
      
      // Map contract addresses to Live Coin Watch token codes
      const contractToCodeMap: Record<string, string> = {
        "0x55d398326f99059ff775485246999027b3197955": "USDT",
        "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "BNB", 
        "0x2170ed0880ac9a755fd29b2688956bd959f933f8": "ETH",
        "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
        "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c": "BTC",
        "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82": "CAKE",
        "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3": "DAI",
        "0xe9e7cea3dedca5984780bafc599bd69add087d56": "BUSD",
        "0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd": "LINK",
        "0x3ee2200efb3400fabb9aacf31297cbdd1d435d47": "ADA",
        "0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe": "XRP",
        "0x4338665cbb7b2485a8855a139b75d5e34ab0db94": "LTC",
        "0x2859e4544c4bb03966803b044a93563bd2d0dd4d": "SHIB",
        "0x947950bcc74888a40ffa2593c5798f11fc9124c4": "SUSHI",
        "0xba2ae424d960c26247dd6c32edc70b295c744c43": "DOGE",
        "0x7083609fce4d1d8dc0c979aab8c869ea2c873402": "DOT",
        "0x85eac5ac2f758618dfa09b24877528ed53bc59d2": "TRX"
      };
      
      const tokenCode = contractToCodeMap[normalizedAddress];
      
      if (tokenCode) {
        try {
          // Get current Live Coin Watch price for this token
          const liveCoinData = await db
            .select()
            .from(schema.liveCoinWatchCoins)
            .where(eq(schema.liveCoinWatchCoins.code, tokenCode))
            .limit(1);
            
          if (liveCoinData.length > 0) {
            currentPrice = liveCoinData[0].rate;
          }
        } catch (error) {
          console.error(`Error fetching Live Coin Watch price for ${tokenCode}:`, error);
        }
      }
      const now = Date.now();
      const data = [];
      
      let dataPoints = 15;
      let intervalMinutes = 4;
      
      switch (timeframe) {
        case "1H":
          dataPoints = 15;
          intervalMinutes = 4; // 4-minute intervals for 1 hour (15 * 4 = 60 minutes)
          break;
        case "1D":
          dataPoints = 24;
          intervalMinutes = 60; // 1-hour intervals for 24 hours
          break;
        case "7D":
          dataPoints = 28;
          intervalMinutes = 6 * 60; // 6-hour intervals for 7 days (28 * 6 = 168 hours = 7 days)
          break;
        case "30D":
          dataPoints = 30;
          intervalMinutes = 24 * 60; // 24-hour intervals for 30 days
          break;
      }
      
      // Log timeframe calculation for verification
      const totalDurationMinutes = dataPoints * intervalMinutes;
      const totalDurationHours = totalDurationMinutes / 60;
      console.log(`Netlify timeframe ${timeframe}: ${dataPoints} points, ${intervalMinutes}min intervals = ${totalDurationHours}h total`);
      
      // ONLY USE REAL PRICES - no artificial generation  
      // Return error if no real historical data available
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          message: "No real historical data available for this token",
          note: "Only authentic Live Coin Watch data is supported - no synthetic price generation"
        })
      };
    };

    const priceHistory = await generatePriceHistory(contractAddress, timeframe);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(priceHistory),
    };
  } catch (error) {
    console.error("Error fetching price history:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to fetch price history",
        error: error instanceof Error ? error.message : "Unknown error"
      }),
    };
  }
};