import type { Handler } from '@netlify/functions';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { desc } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
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
    // Fetch all coins from database - order by cap descending, nulls last
    const coins = await db
      .select()
      .from(schema.liveCoinWatchCoins)
      .orderBy(desc(schema.liveCoinWatchCoins.cap))
      .limit(100);

    // Transform database data to match expected API format
    const response = {
      coins: coins.map(coin => ({
        id: coin.id,
        code: coin.code,
        name: coin.name,
        rate: coin.rate,
        volume: coin.volume,
        cap: coin.cap,
        deltaHour: coin.deltaHour,
        deltaDay: coin.deltaDay,
        deltaWeek: coin.deltaWeek,
        deltaMonth: coin.deltaMonth,
        deltaQuarter: coin.deltaQuarter,
        deltaYear: coin.deltaYear,
        lastUpdated: coin.lastUpdated?.toISOString() || new Date().toISOString(),
      }))
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error fetching Live Coin Watch coins:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: 'Failed to fetch coins data',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};