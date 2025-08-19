import type { Handler } from '@netlify/functions';

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
    // Extract contract address from path
    const contractAddress = event.path.split('/').pop();
    
    if (!contractAddress) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Contract address is required' }),
      };
    }

    // Return static transaction data (matches server implementation)
    const staticTransactions = [
      {
        hash: "0x1234567890abcdef1234567890abcdef12345678",
        from_address: "0x9876543210fedcba9876543210fedcba98765432",
        to_address: "0xabcdef1234567890abcdef1234567890abcdef12",
        value: "1000000000000000000",
        transaction_fee: "21000",
        block_timestamp: new Date(Date.now() - 300000).toISOString(),
        block_number: "38234567"
      },
      {
        hash: "0xabcdef1234567890abcdef1234567890abcdef12",
        from_address: "0x1111222233334444555566667777888899990000",
        to_address: "0x0000999988887777666655554444333322221111",
        value: "2500000000000000000",
        transaction_fee: "21000",
        block_timestamp: new Date(Date.now() - 600000).toISOString(),
        block_number: "38234566"
      }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(staticTransactions),
    };
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: "Failed to fetch transactions",
        error: error instanceof Error ? error.message : "Unknown error"
      }),
    };
  }
};