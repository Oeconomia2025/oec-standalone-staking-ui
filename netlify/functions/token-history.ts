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
    // Extract token and timeframe from query parameters
    const tokenCode = event.queryStringParameters?.token;
    const timeframe = event.queryStringParameters?.timeframe || '1D';

    if (!tokenCode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Token code is required' }),
      };
    }

    console.log(`Fetching ${tokenCode} historical data for timeframe: ${timeframe}`);

    // Fetch token historical data from database (same table as ETH)
    const historicalData = await db
      .select({
        timestamp: schema.priceHistoryData.timestamp,
        price: schema.priceHistoryData.price
      })
      .from(schema.priceHistoryData)
      .where(and(
        eq(schema.priceHistoryData.tokenCode, tokenCode.toUpperCase()),
        eq(schema.priceHistoryData.timeframe, timeframe)
      ))
      .orderBy(schema.priceHistoryData.timestamp);

    // Data is already in correct format from select
    const formattedData = historicalData;

    // Debug logging
    console.log(`Found ${formattedData.length} records for ${tokenCode} ${timeframe}`);
    console.log('Sample data:', formattedData.slice(0, 2));
    
    // If no data found, return empty array to prevent synthetic data
    if (formattedData.length === 0) {
      console.log(`No ${tokenCode} historical data found for timeframe: ${timeframe}, returning empty data`);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      };
    }

    console.log(`Found ${formattedData.length} historical records for ${tokenCode}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedData),
    };
  } catch (error) {
    console.error('Error fetching token historical data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: 'Failed to fetch token historical data',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};