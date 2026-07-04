export default {
  async fetch(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();

    if (!query) {
      return Response.json(
        {
          error: "검색어를 입력해 주세요.",
          places: [],
        },
        { status: 400 }
      );
    }

    if (query.length > 100) {
      return Response.json(
        {
          error: "검색어는 100자 이하로 입력해 주세요.",
          places: [],
        },
        { status: 400 }
      );
    }

    const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

    if (!kakaoRestApiKey) {
      return Response.json(
        {
          error: "카카오 API 키가 설정되지 않았어요.",
          places: [],
        },
        { status: 500 }
      );
    }

    try {
      const kakaoUrl = new URL(
        "https://dapi.kakao.com/v2/local/search/keyword.json"
      );

      kakaoUrl.searchParams.set("query", query);
      kakaoUrl.searchParams.set("size", "10");

      const kakaoResponse = await fetch(kakaoUrl, {
        headers: {
          Authorization: `KakaoAK ${kakaoRestApiKey}`,
        },
      });

      const kakaoData = await kakaoResponse.json();

      if (!kakaoResponse.ok) {
        return Response.json(
          {
            error: "카카오 장소 검색에 실패했어요.",
            places: [],
          },
          { status: kakaoResponse.status }
        );
      }

      const places = (kakaoData.documents || []).map((place) => ({
        id: place.id,
        name: place.place_name,
        address: place.road_address_name || place.address_name || "",
        latitude: Number(place.y),
        longitude: Number(place.x),
        category: place.category_name || "",
      }));

      return Response.json({
        places,
      });
    } catch (error) {
      return Response.json(
        {
          error: "장소 검색 중 문제가 발생했어요.",
          places: [],
        },
        { status: 500 }
      );
    }
  },
};