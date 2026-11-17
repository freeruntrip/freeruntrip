/* FreeRunTrip opening v1. White background, black wordmark, 2 seconds.
 * Add this classic script just after <body>, after frt-opening-audio.js.
 * data-sound-src="" keeps the approved sound; set a URL for a recording.
 * This overlay never navigates or changes activity/account data.
 */
(function (global, doc) {
  'use strict';

  var script = doc.currentScript;
  var attrs = script ? script.dataset : {};
  var scriptURL = script && script.src ? script.src : doc.baseURI;
  var logoURL = attrs.logoSrc || new URL('frt-opening-logo.webp', scriptURL).href;
  var soundURL = attrs.soundSrc || '';
  var volume = Number(attrs.soundVolume);
  if (!Number.isFinite(volume)) volume = 1;
  volume = Math.min(1, Math.max(0, volume));
  var duration = 2000;
  var sessionKey = 'frtOpeningSeenV1';
  var recoveryPrefix = 'freeRunTripActiveRunTripV1:';
  var active = null;
  var seenInDocument = false;

  function stopAudio() {
    try {
      if (global.FrtOpeningAudio) global.FrtOpeningAudio.stop();
    } catch (_) { /* Audio failure must not affect the app. */ }
  }

  function dismiss() {
    var run = active;
    active = null;
    stopAudio();
    if (!run) return;
    global.clearTimeout(run.timer);
    run.logo.onload = null;
    run.logo.onerror = null;
    if (run.node.parentNode) run.node.parentNode.removeChild(run.node);
  }

  function hasRecovery() {
    try {
      var storage = global.localStorage;
      for (var i = 0; i < storage.length; i += 1) {
        var key = storage.key(i);
        if (!key || key.indexOf(recoveryPrefix) !== 0) continue;
        try {
          var state = JSON.parse(storage.getItem(key));
          if (state && state.version === 1 && state.startTime &&
              state.draft && state.plannedRouteSummary) return true;
        } catch (_) { /* Leave malformed app data to the app's recovery code. */ }
      }
    } catch (_) { return true; } // If recovery cannot be checked, show the app directly.
    return false;
  }

  function isAuthReturn() {
    try {
      if (global.freeRunTripAuthReturn && global.freeRunTripAuthReturn.kind) return true;
      var url = new URL(global.location.href);
      var hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      var params = url.searchParams;
      var names = ['auth', 'code', 'access_token', 'refresh_token', 'error', 'error_code'];
      return names.some(function (name) { return params.has(name) || hash.has(name); });
    } catch (_) { return false; }
  }

  function alreadySeen() {
    if (seenInDocument) return true;
    try { return global.sessionStorage.getItem(sessionKey) === '1'; }
    catch (_) { return false; }
  }

  function rememberVisit() {
    seenInDocument = true;
    try { global.sessionStorage.setItem(sessionKey, '1'); } catch (_) {}
  }

  function isHistoryReturn() {
    try {
      var entries = global.performance.getEntriesByType('navigation');
      return entries.length > 0 && entries[0].type === 'back_forward';
    } catch (_) { return false; }
  }

  function createOverlay() {
    var root = doc.createElement('div');
    root.id = 'frtOpening';
    root.className = 'frt-opening';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-label', 'FreeRunTrip 시작');
    var glow = doc.createElement('div');
    glow.className = 'frt-opening__glow';
    glow.setAttribute('aria-hidden', 'true');
    var lockup = doc.createElement('div');
    lockup.className = 'frt-opening__lockup';
    var mark = doc.createElement('img');
    mark.className = 'frt-opening__emblem';
    mark.alt = '';
    mark.width = 1272;
    mark.height = 1237;
    mark.decoding = 'async';
    mark.src = logoURL;
    var word = mark.cloneNode(false);
    word.className = 'frt-opening__wordmark';
    var fallback = doc.createElement('span');
    fallback.className = 'frt-opening__fallback';
    fallback.textContent = 'FreeRunTrip';
    lockup.setAttribute('aria-hidden', 'true');
    lockup.appendChild(mark);
    lockup.appendChild(word);
    lockup.appendChild(fallback);
    root.appendChild(glow);
    root.appendChild(lockup);
    mark.onload = function () { root.classList.add('frt-opening--image-ready'); };
    mark.onerror = function () { root.classList.add('frt-opening--image-failed'); };
    if (mark.complete && mark.naturalWidth > 0) root.classList.add('frt-opening--image-ready');
    else if (mark.complete) root.classList.add('frt-opening--image-failed');
    return {node: root, logo: mark, timer: null};
  }

  function show(isPreview) {
    if (doc.hidden || !doc.body) return false;
    // Recovery and auth always take priority, even if a demo is triggered.
    if (hasRecovery() || isAuthReturn()) return false;
    if (!isPreview && (alreadySeen() || isHistoryReturn())) return false;
    dismiss();
    var run;
    try {
      run = createOverlay();
      active = run;
      doc.body.appendChild(run.node);
      // A missing stylesheet must never leave a large unstyled overlay behind.
      if (global.getComputedStyle(run.node).position !== 'fixed') {
        dismiss();
        return false;
      }
      if (!isPreview) rememberVisit();
      // Independent hard stop. Neither image loading nor audio readiness is awaited.
      run.timer = global.setTimeout(function () {
        if (active === run) dismiss();
      }, duration);
      run.node.addEventListener('animationend', function (event) {
        if (active === run && event.target === run.node &&
            event.animationName === 'frt-opening-lifetime') dismiss();
      });
      if (global.FrtOpeningAudio && volume > 0) {
        try {
          var attempt = global.FrtOpeningAudio.play({src: soundURL, volume: volume});
          if (attempt && typeof attempt.catch === 'function') attempt.catch(function () {});
        } catch (_) { /* The opening continues silently. */ }
      }
      return true;
    } catch (_) {
      dismiss();
      return false;
    }
  }

  if (global.FrtOpening && typeof global.FrtOpening.dismiss === 'function') {
    global.FrtOpening.dismiss();
  }
  global.FrtOpening = Object.freeze({
    dismiss: dismiss,
    playPreview: function () { return show(true); }
  });
  doc.addEventListener('visibilitychange', function () { if (doc.hidden) dismiss(); });
  global.addEventListener('pagehide', dismiss);
  global.addEventListener('pageshow', function (event) { if (event.persisted) dismiss(); });
  doc.addEventListener('keydown', function (event) {
    if (active && event.key === 'Escape') dismiss();
  });
  if (attrs.autoStart !== 'false') show(false);
})(window, document);
