/* FreeRunTrip opening audio.
 * play({ src: '', volume: 1 }) uses the approved preview sound.
 * Set src to a recorded audio file later; the animation needs no changes.
 * A blocked start resolves false after at most 420ms. Never wait for this
 * promise before showing the app. No sound or AudioContext is created on load.
 */
(function (global) {
  'use strict';

  var previous = global.FrtOpeningAudio;
  if (previous && typeof previous.dispose === 'function') previous.dispose();

  var generation = 0;
  var active = null;
  var disposed = false;
  var doc = global.document;

  function release(record) {
    if (!record || record.released) return;
    record.released = true;
    global.clearTimeout(record.finishTimer);
    if (record.cancelReady) record.cancelReady();
    record.cleanups.forEach(function (cleanup) { cleanup(); });
    record.cleanups.length = 0;
    if (record.audio) {
      try { record.audio.pause(); } catch (_) { /* Already unloaded. */ }
      try { record.audio.currentTime = 0; } catch (_) { /* Metadata unavailable. */ }
      // Abort any pending load/play, so a recording cannot start after the
      // opening has ended or a later user gesture unlocks audio.
      try {
        record.audio.removeAttribute('src');
        record.audio.load();
      } catch (_) { /* Cleanup must not block the app. */ }
    }
    record.nodes.forEach(function (node) {
      if (typeof node.stop === 'function') {
        try { node.stop(); } catch (_) { /* Already stopped or not started. */ }
      }
      try { node.disconnect(); } catch (_) { /* Already disconnected. */ }
    });
    record.nodes.length = 0;
    if (record.context) {
      try {
        var closing = record.context.close();
        if (closing && typeof closing.catch === 'function') closing.catch(function () {});
      } catch (_) { /* Closing blocked/closed audio must not block the app. */ }
    }
    if (active === record) active = null;
  }

  function stop() {
    generation += 1;
    release(active);
  }

  function keep(record, node) {
    record.nodes.push(node);
    return node;
  }

  function partial(record, output, frequency, onset, duration, amplitude) {
    var ctx = record.context;
    var oscillator = keep(record, ctx.createOscillator());
    var envelope = keep(record, ctx.createGain());
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, onset);
    envelope.gain.setValueAtTime(0.0001, onset);
    envelope.gain.exponentialRampToValueAtTime(amplitude, onset + 0.009);
    envelope.gain.exponentialRampToValueAtTime(amplitude * 0.34, onset + 0.11);
    envelope.gain.exponentialRampToValueAtTime(0.0001, onset + duration);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(onset);
    oscillator.stop(onset + duration + 0.025);
  }

  function newRecord() {
    return {
      context: null, audio: null, nodes: [], cleanups: [],
      released: false, finishTimer: null, cancelReady: null
    };
  }

  function isCurrent(record, token) {
    return !disposed && token === generation && active === record &&
      !record.released && !(doc && doc.hidden);
  }

  // start() runs synchronously before the first await, preserving a caller's
  // user activation. No future click/touch handler is ever installed.
  function waitForStart(record, start, hasStarted) {
    return new Promise(function (resolve) {
      var settled = false;
      var timeout;
      function onPlaying() { settle(hasStarted()); }
      function onError() { settle(false); }
      function settle(value) {
        if (settled) return;
        settled = true;
        global.clearTimeout(timeout);
        record.cancelReady = null;
        if (record.audio) {
          record.audio.removeEventListener('playing', onPlaying);
          record.audio.removeEventListener('error', onError);
        }
        resolve(value);
      }
      record.cancelReady = function () { settle(false); };
      if (record.audio) {
        record.audio.addEventListener('playing', onPlaying);
        record.audio.addEventListener('error', onError);
      }
      timeout = global.setTimeout(function () { settle(false); }, 420);
      try {
        var attempt = start();
        if (attempt && typeof attempt.then === 'function') {
          attempt.then(function () { settle(hasStarted()); }, function () { settle(false); });
        } else if (hasStarted()) {
          settle(true);
        }
      } catch (_) {
        settle(false);
      }
    });
  }

  async function play(options) {
    stop();
    var token = generation;
    if (disposed || (doc && doc.hidden)) return false;
    options = options || {};
    var src = typeof options.src === 'string' ? options.src.trim() : '';
    var requestedVolume = typeof options.volume === 'number' && isFinite(options.volume)
      ? options.volume : 1;
    var volume = Math.max(0, Math.min(1, requestedVolume));
    if (volume === 0) return false;

    var record = newRecord();
    active = record;
    try {
      if (src) {
        if (typeof global.Audio !== 'function') { release(record); return false; }
        var audio = new global.Audio();
        record.audio = audio;
        audio.preload = 'auto';
        audio.loop = false;
        audio.volume = volume;
        audio.src = src;
        var onFinished = function () { release(record); };
        audio.addEventListener('ended', onFinished);
        audio.addEventListener('error', onFinished);
        record.cleanups.push(function () {
          audio.removeEventListener('ended', onFinished);
          audio.removeEventListener('error', onFinished);
        });
        // The controller also stops at two seconds. This cap independently
        // prevents an accidentally long recording from outliving the intro.
        record.finishTimer = global.setTimeout(function () { release(record); }, 2000);
        var fileReady = await waitForStart(record, function () {
          return audio.play();
        }, function () {
          return !audio.paused && !audio.ended && !record.released;
        });
        if (!fileReady || !isCurrent(record, token)) { release(record); return false; }
        return true;
      }

      var AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) { release(record); return false; }
      var ctx = new AudioContextClass({ latencyHint: 'interactive' });
      record.context = ctx;
      var ready = await waitForStart(record, function () {
        return ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      }, function () { return ctx.state === 'running'; });
      if (!ready || !isCurrent(record, token)) { release(record); return false; }

      var context = record.context;
      var master = keep(record, context.createGain());
      master.gain.setValueAtTime(0.44 * volume, context.currentTime);
      master.connect(context.destination);

      // Preserve the approved preview's notes, envelopes, start offset,
      // overtones and default loudness exactly.
      var start = context.currentTime + 0.025;
      var notes = [
        { frequency: 392.00, offset: 0.00, duration: 0.72, amplitude: 0.30 },
        { frequency: 523.25, offset: 0.23, duration: 0.80, amplitude: 0.28 },
        { frequency: 659.25, offset: 0.53, duration: 1.02, amplitude: 0.26 }
      ];
      notes.forEach(function (note) {
        var onset = start + note.offset;
        partial(record, master, note.frequency, onset, note.duration, note.amplitude);
        partial(record, master, note.frequency * 2.003, onset, 0.25, note.amplitude * 0.18);
      });
      record.finishTimer = global.setTimeout(function () { release(record); }, 1750);
      return true;
    } catch (_) {
      release(record);
      return false;
    }
  }

  function onVisibilityChange() {
    if (doc && doc.hidden) stop();
  }

  function dispose() {
    disposed = true;
    stop();
    if (doc) doc.removeEventListener('visibilitychange', onVisibilityChange);
    global.removeEventListener('pagehide', stop);
  }

  if (doc) doc.addEventListener('visibilitychange', onVisibilityChange);
  // Stop, without permanently disposing, so a back/forward-cache restoration
  // can still use this helper if the controller explicitly requests playback.
  global.addEventListener('pagehide', stop);
  global.FrtOpeningAudio = Object.freeze({ play: play, stop: stop, dispose: dispose });
})(window);
