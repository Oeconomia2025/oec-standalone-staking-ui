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
    // Get token code from query parameter
    const tokenCode = event.queryStringParameters?.token || 'ETH';

    // Fetch specific token from database
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

    // Format data to match expected structure
    const formattedToken = {
      code: tokenData.code,
      name: tokenData.name,
      rate: tokenData.rate,
      volume: tokenData.volume,
      cap: tokenData.cap,
      delta: {
        hour: tokenData.deltaHour,
        day: tokenData.deltaDay,
        week: tokenData.deltaWeek,
        month: tokenData.deltaMonth,
        quarter: tokenData.deltaQuarter,
        year: tokenData.deltaYear
      },
      rank: tokenData.id, // Use id as rank since rank field doesn't exist  
      circulatingSupply: tokenData.circulatingSupply,
      totalSupply: tokenData.totalSupply,
      maxSupply: tokenData.maxSupply
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedToken),
    };
  } catch (error) {
    console.error(`Error fetching token data:`, error);
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