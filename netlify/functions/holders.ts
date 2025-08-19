import type { Handler } from '@netlify/functions';


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
    // Extract contract address from path
    const contractAddress = event.path.split('/').pop();
    
    if (!contractAddress) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Contract address is required' }),
      };
    }

    // Mock holder data - use Moralis, Alchemy, or similar for real data
    const mockHolders = [
      {
        address: "0x1234567890123456789012345678901234567890",
        balance: 12500000,
        percentage: 12.5,
        rank: 1,
      },
      {
        address: "0x9abcdef0123456789012345678901234567890ab",
        balance: 8200000,
        percentage: 8.2,
        rank: 2,
      },
      {
        address: "0x5678901234567890123456789012345678901234",
        balance: 6100000,
        percentage: 6.1,
        rank: 3,
      },
      {
        address: "0x3456789012345678901234567890123456789012",
        balance: 4500000,
        percentage: 4.5,
        rank: 4,
      },
      {
        address: "0x7890123456789012345678901234567890123456",
        balance: 3200000,
        percentage: 3.2,
        rank: 5,
      },
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockHolders),
    };
  } catch (error) {
    console.error("Error fetching holders:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to fetch holders",
        error: error instanceof Error ? error.message : "Unknown error"
      }),
    };
  }
};