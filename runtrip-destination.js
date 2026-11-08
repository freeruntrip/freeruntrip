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

    const AUTOMATIC_NAVIGATION_SOURCE = 'mapbox-walking';
    const MAX_TARGET_DISTANCE_METERS = 250;
    const MAX_SNAP_DISTANCE_METERS = 75;
    const MAX_ROUTE_END_DISTANCE_METERS = 2;
    const COORDINATE_MATCH_EPSILON = 0.0000001;

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

    // 장소의 원래 좌표
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

    // 지도 표시와 도착 판정에 사용하는 좌표
    function getNavigationLatLng(place) {
      if (!isPlaceObject(place)) {
        return null;
      }

      return (
        getPlaceLatLng(place.navigationPoint) ||
        getPlaceLatLng(place)
      );
    }

    // 재계산할 때 자동 보정값이 누적 이동하지 않도록
    // 원래 장소 좌표에서 다시 경로를 계산한다.
    function getRoutingLatLng(place) {
      if (!isPlaceObject(place)) {
        return null;
      }

      return place.navigationPoint?.source === AUTOMATIC_NAVIGATION_SOURCE
        ? getPlaceLatLng(place)
        : getNavigationLatLng(place);
    }

    function getRouteLatLng(coordinate) {
      if (
        !Array.isArray(coordinate) ||
        coordinate.length < 2 ||
        typeof coordinate[0] !== 'number' ||
        typeof coordinate[1] !== 'number'
      ) {
        return null;
      }

      return getPlaceLatLng({
        latitude: coordinate[0],
        longitude: coordinate[1]
      });
    }

    function samePosition(first, second) {
      return (
        first &&
        second &&
        Math.abs(first[0] - second[0]) <= COORDINATE_MATCH_EPSILON &&
        Math.abs(first[1] - second[1]) <= COORDINATE_MATCH_EPSILON
      );
    }

    function distanceMeters(first, second) {
      const radians = Math.PI / 180;
      const latitudeDelta = (second[0] - first[0]) * radians;
      const longitudeDelta = (second[1] - first[1]) * radians;

      const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(first[0] * radians) *
          Math.cos(second[0] * radians) *
          Math.sin(longitudeDelta / 2) ** 2;

      return 6371000 * 2 * Math.asin(
        Math.sqrt(Math.max(0, Math.min(1, haversine)))
      );
    }

    function withoutAutomaticNavigationPoint(place) {
      if (place.navigationPoint?.source !== AUTOMATIC_NAVIGATION_SOURCE) {
        return place;
      }

      const originalPlace = { ...place };
      delete originalPlace.navigationPoint;

      return originalPlace;
    }

    // 서버가 선택한 접근점과 실제 보행 경로 끝점을 검증한 뒤 적용한다.
    function withAutomaticNavigationPoint(place, route, options = {}) {
      if (!isPlaceObject(place)) {
        return null;
      }

      if (
        options?.returnToStart === true ||
        place.isCurrentLocation === true ||
        place.type === 'current-location'
      ) {
        return place;
      }

      if (
        getPlaceLatLng(place.navigationPoint) &&
        place.navigationPoint.source !== AUTOMATIC_NAVIGATION_SOURCE
      ) {
        // 이전 기록에 저장된 수동 도착점도 복원할 수 있게 유지한다.
        return place;
      }

      const fallbackPlace = withoutAutomaticNavigationPoint(place);
      const originalPosition = getPlaceLatLng(place);
      const requestedPosition = getRouteLatLng(route?.requestedDestination);
      const targetPosition = getRouteLatLng(route?.destinationTarget);
      const source = route?.destinationSource;

      if (
        !originalPosition ||
        route?.provider !== 'mapbox' ||
        route?.profile !== 'mapbox/walking' ||
        ![
          'google-preferred-entrance',
          'google-walking-navigation',
          'place-coordinate'
        ].includes(source) ||
        !samePosition(requestedPosition, getRoutingLatLng(place)) ||
        !targetPosition ||
        (
          source === 'place-coordinate' &&
          !samePosition(targetPosition, requestedPosition)
        ) ||
        distanceMeters(originalPosition, targetPosition) > MAX_TARGET_DISTANCE_METERS ||
        !Array.isArray(route.coordinates) ||
        route.coordinates.length < 2 ||
        !route.coordinates.every(function (point) {
          return Boolean(getRouteLatLng(point));
        }) ||
        !Array.isArray(route.snappedWaypoints) ||
        route.snappedWaypoints.length < 2
      ) {
        return fallbackPlace;
      }

      const lastWaypoint =
        route.snappedWaypoints[route.snappedWaypoints.length - 1];

      const snappedInput = getRouteLatLng(lastWaypoint?.inputLocation);
      const snappedPosition = getRouteLatLng(lastWaypoint?.location);

      const routeEnd = getRouteLatLng(
        route.coordinates[route.coordinates.length - 1]
      );

      if (
        lastWaypoint?.index !== route.snappedWaypoints.length - 1 ||
        !samePosition(snappedInput, targetPosition) ||
        !snappedPosition ||
        distanceMeters(targetPosition, snappedPosition) > MAX_SNAP_DISTANCE_METERS ||
        distanceMeters(snappedPosition, routeEnd) > MAX_ROUTE_END_DISTANCE_METERS
      ) {
        return fallbackPlace;
      }

      return {
        ...place,
        navigationPoint: {
          latitude: snappedPosition[0],
          longitude: snappedPosition[1],
          source: AUTOMATIC_NAVIGATION_SOURCE
        }
      };
    }

    // 기존 저장 기록과의 호환을 위한 함수
    function withNavigationPoint(place, latitude, longitude) {
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

    function copyNavigationPoint(place) {
      if (!isPlaceObject(place)) {
        return null;
      }

      const position = getPlaceLatLng(place.navigationPoint);

      if (!position) {
        return null;
      }

      const point = {
        latitude: position[0],
        longitude: position[1]
      };

      if (typeof place.navigationPoint.source === 'string') {
        point.source = place.navigationPoint.source;
      }

      return point;
    }

    return {
      getPlaceLatLng,
      getNavigationLatLng,
      getRoutingLatLng,
      withNavigationPoint,
      withAutomaticNavigationPoint,
      copyNavigationPoint
    };
  }
);