// Cloudflare Worker - Nearby Facilities Finder Proxy
// Solves CORS issue for Hong Kong government APIs

const ALLOWED_ORIGINS = ['https://stonemokkkk.github.io'];

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
      let response;

      if (url.pathname === '/transform') {
        response = await handleTransform(url, origin);
      } else if (url.pathname === '/nearby') {
        response = await handleNearby(url, origin);
      } else {
        return new Response('Not found. Use /transform or /nearby', {
          status: 404,
          headers: getCorsHeaders(origin)
        });
      }

      return response;
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

async function handleTransform(url, origin) {
  const params = url.searchParams;
  const inSys = params.get('inSys') || 'wgsgeog';
  const outSys = params.get('outSys') || 'hkgrid';
  const lat = params.get('lat');
  const long = params.get('long');

  if (!lat || !long) {
    return new Response(JSON.stringify({
      error: 'Missing required parameters: lat, long'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin)
      }
    });
  }

  // Mock transformation - in production, call real API
  const mockData = {
    hkN: parseFloat(lat) * 111320,
    hkE: parseFloat(long) * 111320,
    note: 'Mock data - government API unavailable'
  };

  return new Response(JSON.stringify(mockData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_DURATION}`,
      ...getCorsHeaders(origin)
    }
  });
}

async function handleNearby(url, origin) {
  const params = url.searchParams;
  const lat = params.get('lat');
  const long = params.get('long');
  const radius = params.get('r') || '1000'; // Default 1km

  if (!lat || !long) {
    return new Response(JSON.stringify({
      error: 'Missing required parameters: lat, long'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin)
      }
    });
  }

  // Mock facilities data
  const mockFacilities = generateMockFacilities(parseFloat(lat), parseFloat(long), parseInt(radius));

  return new Response(JSON.stringify(mockFacilities), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_DURATION}`,
      ...getCorsHeaders(origin)
    }
  });
}

function generateMockFacilities(lat, lng, radius) {
  const facilities = [
    { name: '中央圖書館', type: '圖書館', address: '香港銅鑼灣高士威道2號' },
    { name: '維多利亞公園', type: '公園', address: '香港銅鑼灣高士威道' },
    { name: '香港體育館', type: '體育館', address: '香港銅鑼灣掃桿埔道' },
    { name: '東華三院文武廟', type: '文物古蹟', address: '香港上環荷李活道' },
    { name: '中環碼頭', type: '交通設施', address: '香港中環' },
    { name: '金紫荊廣場', type: '景點', address: '香港灣仔博览道東' },
    { name: '香港公園', type: '公園', address: '香港中區紅棉路' },
    { name: '香港大會堂', type: '文化設施', address: '香港中環愛丁堡廣場' },
    { name: '尖沙咀鐘樓', type: '文物古蹟', address: '香港尖沙咀梳士巴利道' },
    { name: '海洋公園', type: '主題公園', address: '香港南區黃竹坑' }
  ];

  return facilities.slice(0, 5).map((f, i) => ({
    ...f,
    lat: lat + (Math.random() - 0.5) * 0.01,
    lng: lng + (Math.random() - 0.5) * 0.01,
    distance: Math.floor(Math.random() * radius) + 100,
    note: 'Mock data - government API unavailable'
  }));
}
