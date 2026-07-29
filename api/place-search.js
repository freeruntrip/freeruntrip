function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function createKakaoHeaders(kakaoRestApiKey) {
  return {
    Authorization: `KakaoAK ${kakaoRestApiKey}`,
  };
}

function normalizeKeywordPlaces(documents = []) {
  return documents.map((place) => ({
    id: `keyword-${place.id}`,
    name: place.place_name,
    address: place.road_address_name || place.address_name || '',
    roadAddress: place.road_address_name || '',
    lotAddress: place.address_name || '',
    latitude: Number(place.y),
    longitude: Number(place.x),
    category: place.category_name || '',
    source: 'keyword',
  }));
}

function normalizeAddressPlaces(documents = []) {
  return documents.map((place) => {
    const roadAddress = place.road_address?.address_name || '';
    const lotAddress = place.address?.address_name || place.address_name || '';
    const buildingName = place.road_address?.building_name || '';

    return {
      id: `address-${place.x}-${place.y}`,
      name: buildingName || roadAddress || lotAddress,
      address: roadAddress || lotAddress,
      roadAddress,
      lotAddress,
      latitude: Number(place.y),
      longitude: Number(place.x),
      category: '주소',
      source: 'address',
    };
  });
}

function mergePlaces(addressPlaces, keywordPlaces, limit = 15) {
  const mergedPlaces = [];
  const placeKeys = new Set();

  [...addressPlaces, ...keywordPlaces].forEach((place) => {
    if (
      !Number.isFinite(place.latitude) ||
      !Number.isFinite(place.longitude)
    ) {
      return;
    }

    const coordinateKey = [
      place.latitude.toFixed(6),
      place.longitude.toFixed(6),
    ].join(',');

    const addressKey = (place.address || '')
      .replace(/\s+/g, '')
      .toLowerCase();

    const duplicateKey = addressKey || coordinateKey;

    if (placeKeys.has(duplicateKey)) {
      return;
    }

    placeKeys.add(duplicateKey);
    mergedPlaces.push(place);
  });

  return mergedPlaces.slice(0, limit);
}

async function requestKakaoSearch({
  endpoint,
  query,
  kakaoRestApiKey,
  size = 10,
}) {
  const kakaoUrl = new URL(endpoint);

  kakaoUrl.searchParams.set('query', query);
  kakaoUrl.searchParams.set('size', String(size));

  const response = await fetch(kakaoUrl, {
    headers: createKakaoHeaders(kakaoRestApiKey),
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'GET') {
      return jsonResponse(
        {
          error: '지원하지 않는 요청 방식이에요.',
          places: [],
        },
        405
      );
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim();

    if (!query) {
      return jsonResponse(
        {
          error: '검색어를 입력해 주세요.',
          places: [],
        },
        400
      );
    }

    if (query.length > 100) {
      return jsonResponse(
        {
          error: '검색어는 100자 이하로 입력해 주세요.',
          places: [],
        },
        400
      );
    }

    const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

    if (!kakaoRestApiKey) {
      return jsonResponse(
        {
          error: '카카오 API 키가 설정되지 않았어요.',
          places: [],
        },
        500
      );
    }

    try {
      const [addressResult, keywordResult] = await Promise.all([
        requestKakaoSearch({
          endpoint:
            'https://dapi.kakao.com/v2/local/search/address.json',
          query,
          kakaoRestApiKey,
          size: 10,
        }),
        requestKakaoSearch({
          endpoint:
            'https://dapi.kakao.com/v2/local/search/keyword.json',
          query,
          kakaoRestApiKey,
          size: 10,
        }),
      ]);

      if (!addressResult.ok && !keywordResult.ok) {
        return jsonResponse(
          {
            error: '카카오 장소 검색에 실패했어요.',
            kakaoStatus:
              keywordResult.status || addressResult.status,
            kakaoMessage:
              keywordResult.data?.msg ||
              keywordResult.data?.message ||
              addressResult.data?.msg ||
              addressResult.data?.message ||
              '카카오에서 자세한 오류 메시지를 보내지 않았어요.',
            places: [],
          },
          keywordResult.status || addressResult.status || 500
        );
      }

      const addressPlaces = addressResult.ok
        ? normalizeAddressPlaces(addressResult.data.documents)
        : [];

      const keywordPlaces = keywordResult.ok
        ? normalizeKeywordPlaces(keywordResult.data.documents)
        : [];

      const places = mergePlaces(
        addressPlaces,
        keywordPlaces,
        15
      );

      return jsonResponse({
        places,
        searchSources: {
          address: addressResult.ok,
          keyword: keywordResult.ok,
        },
      });
    } catch (error) {
      console.error('Kakao place search error:', error);

      return jsonResponse(
        {
          error: '장소 검색 중 문제가 발생했어요.',
          places: [],
        },
        500
      );
    }
  },
};