(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.FreeRunTripDestination = api;
  }
})(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function () {
    'use strict';

    function isPlaceObject(place) {
      return (
        place !== null &&
        typeof place === 'object' &&
        !Array.isArray(place)
      );
    }

    function normalizeCoordinate(value, limit) {
      if (
        typeof value !== 'number' &&
        typeof value !== 'string'
      ) {
        return null;
      }

      if (
        typeof value === 'string' &&
        value.trim() === ''
      ) {
        return null;
      }

      const number = Number(value);

      return (
        Number.isFinite(number) &&
        number >= -limit &&
        number <= limit
      )
        ? number
        : null;
    }

    // 장소의 원래 좌표를 [위도, 경도] 순서로 반환한다.
    function getPlaceLatLng(place) {
      if (!isPlaceObject(place)) {
        return null;
      }

      const latitude = normalizeCoordinate(
        place.latitude ?? place.lat ?? place.y,
        90
      );

      const longitude = normalizeCoordinate(
        place.longitude ?? place.lng ?? place.x,
        180
      );

      if (latitude === null || longitude === null) {
        return null;
      }

      return [latitude, longitude];
    }

    // 경로 계산과 도착 판정에서 사용할 좌표를 반환한다.
    function getNavigationLatLng(place) {
      if (!isPlaceObject(place)) {
        return null;
      }

      return (
        getPlaceLatLng(place.navigationPoint) ||
        getPlaceLatLng(place)
      );
    }

    // 원래 장소 정보를 보존하며 직접 지정한 도착점을 추가한다.
    function withNavigationPoint(
      place,
      latitude,
      longitude
    ) {
      if (!getPlaceLatLng(place)) {
        return null;
      }

      const position = getPlaceLatLng({
        latitude,
        longitude
      });

      if (!position) {
        return null;
      }

      return {
        ...place,

        navigationPoint: {
          latitude: position[0],
          longitude: position[1],
          source: 'user-selected'
        }
      };
    }

    // 기록 저장과 복구에 사용할 도착점 정보를 복사한다.
    function copyNavigationPoint(place) {
      if (!isPlaceObject(place)) {
        return null;
      }

      const position = getPlaceLatLng(
        place.navigationPoint
      );

      if (!position) {
        return null;
      }

      const point = {
        latitude: position[0],
        longitude: position[1]
      };

      if (
        typeof place.navigationPoint.source === 'string'
      ) {
        point.source = place.navigationPoint.source;
      }

      return point;
    }

    return {
      getPlaceLatLng,
      getNavigationLatLng,
      withNavigationPoint,
      copyNavigationPoint
    };
  }
);