import type { Handler } from '@netlify/functions';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
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
    // Fetch all coins from database
    const coins = await db
      .select()
      .from(schema.liveCoinWatchCoins)
      .orderBy(schema.liveCoinWatchCoins.id);

    // Format data to match expected structure
    const formattedCoins = coins.map(coin => ({
      code: coin.code,
      name: coin.name,
      rate: coin.rate,
      volume: coin.volume,
      cap: coin.cap,
      delta: {
        hour: coin.deltaHour,
        day: coin.deltaDay,
        week: coin.deltaWeek,
        month: coin.deltaMonth,
        quarter: coin.deltaQuarter,
        year: coin.deltaYear
      },
      rank: coin.id, // Use id as rank since rank field doesn't exist
      circulatingSupply: coin.circulatingSupply,
      totalSupply: coin.totalSupply,
      maxSupply: coin.maxSupply
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ coins: formattedCoins }),
    };
  } catch (error) {
    console.error('Error fetching coins data:', error);
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