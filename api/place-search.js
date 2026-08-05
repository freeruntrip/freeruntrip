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
  return documents.map((place) => {
    const roadAddress = place.road_address_name || '';
    const lotAddress = place.address_name || '';
    const placeName = place.place_name || '';

    return {
      id: `keyword-${place.id}`,

      name: placeName,
      displayName: placeName,
      primaryText: placeName,
      secondaryText: roadAddress || lotAddress,

      address: roadAddress || lotAddress,
      roadAddress,
      lotAddress,
      buildingName: placeName,

      latitude: Number(place.y),
      longitude: Number(place.x),

      category: place.category_name || '',
      resultType: 'place',
      source: 'keyword',
    };
  });
}

function getShortAddress(address) {
  const normalizedAddress =
    String(address || '')
      .trim()
      .replace(/\s+/g, ' ');

  if (!normalizedAddress) {
    return '';
  }

  const parts = normalizedAddress.split(' ');

  const roadIndex = parts.findIndex(function (part) {
    return /(?:대로|로|길)$/.test(part);
  });

  if (roadIndex >= 0) {
    return parts
      .slice(roadIndex)
      .join(' ');
  }

  if (parts.length <= 2) {
    return normalizedAddress;
  }

  return parts.slice(-2).join(' ');
}

function normalizeAddressPlaces(documents = []) {
  return documents.map((place) => {
    const roadAddress =
      place.road_address?.address_name || '';

    const lotAddress =
      place.address?.address_name ||
      place.address_name ||
      '';

    const buildingName =
      place.road_address?.building_name || '';

    const mainAddress =
      roadAddress || lotAddress;

    const shortAddress =
      getShortAddress(mainAddress);

    const addressType =
      roadAddress
        ? '도로명 주소'
        : '지번 주소';

    const secondaryParts = [
      buildingName,
      addressType,
    ].filter(Boolean);

    return {
      id: `address-${place.x}-${place.y}`,

      name: shortAddress || mainAddress,
      displayName: shortAddress || mainAddress,
      primaryText: mainAddress,
      secondaryText: secondaryParts.join(' · '),

      address: mainAddress,
      roadAddress,
      lotAddress,
      buildingName,

      latitude: Number(place.y),
      longitude: Number(place.x),

      category: '주소',
      resultType: 'address',
      source: 'address',
    };
  });
}


function normalizeReverseGeocodeDocument(document) {
  if (!document) {
    return null;
  }

  const roadAddress =
    document.road_address?.address_name || '';

  const lotAddress =
    document.address?.address_name || '';

  const buildingName =
    document.road_address?.building_name || '';

  const mainAddress =
    roadAddress || lotAddress;

  if (!mainAddress) {
    return null;
  }

  const shortAddress =
    getShortAddress(mainAddress);

  return {
    id:
      `reverse-${document.x || ''}-${document.y || ''}`,

    name:
      shortAddress || mainAddress,

    displayName:
      shortAddress || mainAddress,

    primaryText:
      mainAddress,

    secondaryText:
      [
        buildingName,
        roadAddress
          ? '도로명 주소'
          : '지번 주소',
      ]
        .filter(Boolean)
        .join(' · '),

    address:
      mainAddress,

    roadAddress,
    lotAddress,
    buildingName,

    latitude:
      Number(document.y),

    longitude:
      Number(document.x),

    category:
      '현재 위치 주소',

    resultType:
      'reverse-geocode',

    source:
      'reverse-geocode',
  };
}

async function requestKakaoReverseGeocode({
  latitude,
  longitude,
  kakaoRestApiKey,
}) {
  const kakaoUrl = new URL(
    'https://dapi.kakao.com/v2/local/geo/coord2address.json'
  );

  kakaoUrl.searchParams.set(
    'x',
    String(longitude)
  );

  kakaoUrl.searchParams.set(
    'y',
    String(latitude)
  );

  kakaoUrl.searchParams.set(
    'input_coord',
    'WGS84'
  );

  const response = await fetch(kakaoUrl, {
    headers:
      createKakaoHeaders(
        kakaoRestApiKey
      ),
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

    const duplicateKey =
      addressKey || coordinateKey;

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
    const latitude = Number(
      url.searchParams.get('lat')
    );
    const longitude = Number(
      url.searchParams.get('lng')
    );
    const isReverseGeocodeRequest =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);

    if (!query && !isReverseGeocodeRequest) {
      return jsonResponse(
        {
          error: '검색어 또는 좌표를 입력해 주세요.',
          places: [],
        },
        400
      );
    }

    if (query && query.length > 100) {
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

    if (isReverseGeocodeRequest) {
      try {
        const reverseResult =
          await requestKakaoReverseGeocode({
            latitude,
            longitude,
            kakaoRestApiKey,
          });

        if (!reverseResult.ok) {
          return jsonResponse(
            {
              error:
                '현재 위치 주소를 찾지 못했어요.',
              place: null,
              kakaoStatus:
                reverseResult.status,
            },
            reverseResult.status || 500
          );
        }

        const document =
          Array.isArray(
            reverseResult.data?.documents
          )
            ? reverseResult.data.documents[0]
            : null;

        const normalizedPlace =
          normalizeReverseGeocodeDocument(
            document
          );

        if (!normalizedPlace) {
          return jsonResponse({
            place: null,
          });
        }

        normalizedPlace.latitude =
          latitude;

        normalizedPlace.longitude =
          longitude;

        return jsonResponse({
          place: normalizedPlace,
        });
      } catch (error) {
        console.error(
          'Kakao reverse geocode error:',
          error
        );

        return jsonResponse(
          {
            error:
              '현재 위치 주소 조회 중 문제가 발생했어요.',
            place: null,
          },
          500
        );
      }
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