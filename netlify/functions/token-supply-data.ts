import type { Handler } from '@netlify/functions';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL || !process.env.LIVE_COIN_WATCH_API_KEY) {
  throw new Error("DATABASE_URL and LIVE_COIN_WATCH_API_KEY must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Fetch authentic supply data from Live Coin Watch API
async function fetchTokenSupplyData(tokenCode: string) {
  try {
    console.log(`🔍 Fetching supply data for ${tokenCode}...`);
    
    // Fetch from Live Coin Watch API with meta=true to get supply data
    const response = await fetch('https://api.livecoinwatch.com/coins/single', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.LIVE_COIN_WATCH_API_KEY!,
      },
      body: JSON.stringify({
        code: tokenCode.toUpperCase(),
        meta: true // Request metadata including supply information
      }),
    });

    if (!response.ok) {
      throw new Error(`Live Coin Watch API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract supply data from API response
    const supplyData = {
      totalSupply: data.totalSupply || null,
      circulatingSupply: data.circulatingSupply || null, 
      maxSupply: data.maxSupply || null
    };

    // Update database with supply data
    await db
      .update(schema.liveCoinWatchCoins)
      .set(supplyData)
      .where(eq(schema.liveCoinWatchCoins.code, tokenCode.toUpperCase()));

    console.log(`✅ Updated ${tokenCode} supply data:`, supplyData);
    return supplyData;

  } catch (error) {
    console.error(`❌ Error fetching ${tokenCode} supply data:`, error);
    return null;
  }
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
    const tokenCode = event.queryStringParameters?.token;
    const action = event.queryStringParameters?.action || 'fetch';
    
    if (!tokenCode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Token code is required'
        })
      };
    }

    if (action === 'fetch') {
      // Fetch and update supply data from API
      const supplyData = await fetchTokenSupplyData(tokenCode);
      
      if (!supplyData) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Supply data not available for ${tokenCode}`
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token: tokenCode.toUpperCase(),
          ...supplyData
        })
      };
    }

    if (action === 'get') {
      // Get supply data from database
      const [tokenData] = await db
        .select({
          totalSupply: schema.liveCoinWatchCoins.totalSupply,
          circulatingSupply: schema.liveCoinWatchCoins.circulatingSupply,
          maxSupply: schema.liveCoinWatchCoins.maxSupply
        })
        .from(schema.liveCoinWatchCoins)
        .where(eq(schema.liveCoinWatchCoins.code, tokenCode.toUpperCase()));

      if (!tokenData) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Token ${tokenCode} not found`
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token: tokenCode.toUpperCase(),
          totalSupply: tokenData.totalSupply,
          circulatingSupply: tokenData.circulatingSupply,
          maxSupply: tokenData.maxSupply
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Invalid action. Use "fetch" or "get"'
      })
    };
    
  } catch (error) {
    console.error('Token supply data error:', error);
    
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