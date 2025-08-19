import type { Handler } from '@netlify/functions';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL || !process.env.LIVE_COIN_WATCH_API_KEY) {
  throw new Error("DATABASE_URL and LIVE_COIN_WATCH_API_KEY must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Fetch authentic historical data for a specific token
async function fetchAuthenticTokenData(tokenCode: string) {
  console.log(`🔍 Fetching AUTHENTIC data for ${tokenCode}...`);
  
  const timeframes = [
    { name: '1H', start: Date.now() - (1 * 60 * 60 * 1000), end: Date.now() },
    { name: '1D', start: Date.now() - (24 * 60 * 60 * 1000), end: Date.now() },
    { name: '7D', start: Date.now() - (7 * 24 * 60 * 60 * 1000), end: Date.now() },
    { name: '30D', start: Date.now() - (30 * 24 * 60 * 60 * 1000), end: Date.now() }
  ];
  
  let totalInserted = 0;
  
  for (const timeframe of timeframes) {
    try {
      // Check if authentic data already exists
      const existingData = await db
        .select()
        .from(schema.priceHistoryData)
        .where(and(
          eq(schema.priceHistoryData.tokenCode, tokenCode),
          eq(schema.priceHistoryData.timeframe, timeframe.name)
        ))
        .limit(1);
      
      if (existingData.length > 0) {
        continue; // Skip if data exists
      }

      // Fetch from Live Coin Watch API
      const response = await fetch('https://api.livecoinwatch.com/coins/single/history', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.LIVE_COIN_WATCH_API_KEY!,
        },
        body: JSON.stringify({
          code: tokenCode,
          start: timeframe.start,
          end: timeframe.end,
          meta: false
        }),
      });

      if (!response.ok) continue;

      const apiData = await response.json();
      if (!apiData.history || !Array.isArray(apiData.history)) continue;

      const historicalData = apiData.history.map((dataPoint: any) => ({
        tokenCode,
        timestamp: dataPoint.date,
        price: dataPoint.rate,
        timeframe: timeframe.name,
      }));

      if (historicalData.length === 0) continue;

      await db
        .insert(schema.priceHistoryData)
        .values(historicalData)
        .onConflictDoNothing();

      totalInserted += historicalData.length;
      console.log(`✅ ${tokenCode} ${timeframe.name}: ${historicalData.length} authentic points`);

    } catch (error) {
      console.error(`❌ ${tokenCode} ${timeframe.name} error:`, error);
    }
  }
  
  return totalInserted;
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const action = event.queryStringParameters?.action || 'sync';
    const tokenCode = event.queryStringParameters?.token;
    
    if (action === 'sync' && tokenCode) {
      // Sync specific token
      const inserted = await fetchAuthenticTokenData(tokenCode.toUpperCase());
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token: tokenCode,
          inserted,
          message: `Synced ${inserted} authentic data points for ${tokenCode}`
        })
      };
    }
    
    if (action === 'sync-all') {
      // Sync all available tokens
      const tokens = await db
        .select({ code: schema.liveCoinWatchCoins.code })
        .from(schema.liveCoinWatchCoins)
        .where(sql`cap IS NOT NULL`)
        .orderBy(sql`cap DESC`)
        .limit(100);
      
      let totalInserted = 0;
      let processedCount = 0;
      
      for (const token of tokens) {
        try {
          const inserted = await fetchAuthenticTokenData(token.code);
          totalInserted += inserted;
          processedCount++;
          
          // Rate limiting
          if (processedCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Failed to sync ${token.code}:`, error);
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          processed: processedCount,
          totalInserted,
          message: `Synced authentic data for ${processedCount} tokens`
        })
      };
    }
    
    // Default: return status
    const tokenCount = await db
      .select({ count: sql`COUNT(DISTINCT token_code)` })
      .from(schema.priceHistoryData);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        tokensWithData: tokenCount[0]?.count || 0,
        message: 'Authentic token sync service ready'
      })
    };
    
  } catch (error) {
    console.error('Authentic token sync error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};