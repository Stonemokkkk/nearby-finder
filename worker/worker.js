// Cloudflare Worker - Nearby Facilities Finder Proxy
// Simplified version - no reverse coordinate transformation

const ALLOWED_ORIGINS = ['https://stonemokkkk.github.io', 'http://localhost:8080'];

// Government API endpoints
const GEODETIC_API = 'https://www.geodetic.gov.hk/transform/v2/';
const MAP_API = 'https://www.map.gov.hk/gs/api/v1.0.0/searchNearby';

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
  const lat = params.get('lat'); // WGS84 latitude
  const lng = params.get('lng'); // WGS84 longitude
  const lang = params.get('lang') || 'zh';

  if (!lat || !lng) {
    return new Response(JSON.stringify({
      error: 'Missing required parameters: lat (WGS84), lng (WGS84)'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin)
      }
    });
  }

  // Step 1: Transform WGS84 to HK80
  const transformUrl = new URL(GEODETIC_API);
  transformUrl.searchParams.set('inSys', 'wgsgeog');
  transformUrl.searchParams.set('outSys', 'hkgrid');
  transformUrl.searchParams.set('lat', lat);
  transformUrl.searchParams.set('long', lng);

  console.log(`Transforming: ${lat}, ${lng}`);

  const transformResponse = await fetch(transformUrl.toString(), {
    headers: {
      'User-Agent': 'NearbyFinder/1.0',
      'Accept': 'application/json'
    }
  });

  if (!transformResponse.ok) {
    throw new Error(`Coordinate transformation failed: ${transformResponse.status}`);
  }

  const transformData = await transformResponse.json();
  console.log('Transform result:', transformData);

  const hk80X = transformData.hkE; // Easting
  const hk80Y = transformData.hkN; // Northing

  // Step 2: Search nearby facilities
  const nearbyUrl = new URL(MAP_API);
  nearbyUrl.searchParams.set('x', hk80X);
  nearbyUrl.searchParams.set('y', hk80Y);
  nearbyUrl.searchParams.set('lang', lang);

  console.log(`Searching nearby: x=${hk80X}, y=${hk80Y}`);

  const nearbyResponse = await fetch(nearbyUrl.toString(), {
    headers: {
      'User-Agent': 'NearbyFinder/1.0',
      'Accept': 'application/json'
    }
  });

  if (!nearbyResponse.ok) {
    throw new Error(`Search nearby failed: ${nearbyResponse.status}`);
  }

  const nearbyData = await nearbyResponse.json();
  console.log(`Found ${nearbyData.length} facilities`);

  // Step 3: Return raw data with HK80 coordinates
  // The frontend will handle the distance calculation using HK80 coordinates
  return new Response(JSON.stringify({
    hk80X: hk80X,
    hk80Y: hk80Y,
    facilities: nearbyData
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_DURATION}`,
      ...getCorsHeaders(origin)
    }
  });
}
