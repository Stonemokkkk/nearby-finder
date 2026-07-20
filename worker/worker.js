// Cloudflare Worker - Nearby Facilities Finder Proxy
// Solves CORS issue for Hong Kong government APIs

const ALLOWED_ORIGINS = ['https://stonemokkkk.github.io', 'http://localhost:8080'];

// Government API endpoint
const GOV_API = 'https://www.map.gov.hk/gs/api/v1.0.0/searchNearby';

// Cache duration in seconds
const CACHE_DURATION = 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin)
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', {
        status: 405,
        headers: getCorsHeaders(origin)
      });
    }

    try {
      if (url.pathname === '/nearby') {
        return await handleNearby(url, origin);
      } else {
        return new Response('Not found. Use /nearby', {
          status: 404,
          headers: getCorsHeaders(origin)
        });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      });
    }
  }
};

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? (ALLOWED_ORIGINS.includes('*') ? '*' : origin) : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

async function handleNearby(url, origin) {
  const params = url.searchParams;
  const x = params.get('x'); // HK80 Easting
  const y = params.get('y'); // HK80 Northing
  const lang = params.get('lang') || 'zh';

  if (!x || !y) {
    return new Response(JSON.stringify({
      error: 'Missing required parameters: x (HK80 Easting), y (HK80 Northing)'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin)
      }
    });
  }

  // Build upstream URL
  const upstreamUrl = new URL(GOV_API);
  upstreamUrl.searchParams.set('x', x);
  upstreamUrl.searchParams.set('y', y);
  upstreamUrl.searchParams.set('lang', lang);

  console.log(`Fetching from: ${upstreamUrl.toString()}`);

  // Fetch from government API
  const response = await fetch(upstreamUrl.toString(), {
    headers: {
      'User-Agent': 'NearbyFinder/1.0',
      'Accept': 'application/json'
    }
  });

  const data = await response.text();

  console.log(`Response status: ${response.status}`);

  return new Response(data, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_DURATION}`,
      ...getCorsHeaders(origin)
    }
  });
}
