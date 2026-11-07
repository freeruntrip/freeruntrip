(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.FreeRunTripRouteVoice = api;
  }
})(
  typeof globalThis !== 'undefined' ? globalThis : this,
  function () {
    'use strict';

    function createController(options) {
      if (!options || typeof options.play !== 'function') {
        throw new TypeError('A voice playback adapter is required.');
      }

      const now =
        typeof options.now === 'function'
          ? options.now
          : Date.now;

      const maxAttempts =
        Number.isInteger(options.maxAttempts) &&
        options.maxAttempts > 0
          ? options.maxAttempts
          : 3;

      const retryDelayMs =
        Number.isFinite(options.retryDelayMs) &&
        options.retryDelayMs >= 0
          ? options.retryDelayMs
          : 1500;

      const steps = new Map();

      let generation = 0;
      let requestSequence = 0;
      let current = null;
      let lastPosition = null;
      let pending = null;
      let suspendedReason = null;

      function gate(name) {
        if (typeof options[name] !== 'function') {
          return false;
        }

        try {
          return Boolean(options[name]());
        } catch (_) {
          return true;
        }
      }

      function isCurrent(request) {
        return (
          pending === request &&
          !request.invalidated &&
          request.generation === generation &&
          suspendedReason === null &&
          current !== null &&
          current.stepKey === request.stepKey &&
          current.record === request.record &&
          !gate('isBlocked')
        );
      }

      function invalidate(reason) {
        if (!pending || pending.invalidated) {
          return;
        }

        pending.invalidated = true;

        if (pending.abortController) {
          pending.abortController.abort();
        }

        if (typeof options.cancel === 'function') {
          try {
            options.cancel(pending.context, reason);
          } catch (_) {
            // 취소 신호와 유효성 검사로 오래된 재생을 차단한다.
          }
        }
      }

      function settle(request, succeeded) {
        if (isCurrent(request)) {
          if (succeeded === true) {
            request.record.spoken = true;
          } else {
            request.record.spoken = false;
            request.record.failures += 1;

            request.record.retryAt =
              now() +
              retryDelayMs *
                Math.pow(2, request.record.failures - 1);
          }
        }

        if (pending === request) {
          pending = null;
        }

        if (request.invalidated) {
          pump();
        }
      }

      function pump() {
        if (
          pending ||
          !current ||
          suspendedReason !== null ||
          gate('isBlocked') ||
          gate('isBusy')
        ) {
          return false;
        }

        const record = current.record;

        if (
          !record ||
          record.spoken ||
          record.failures >= maxAttempts ||
          now() < record.retryAt
        ) {
          return false;
        }

        const request = {
          generation,
          stepKey: current.stepKey,
          record,
          invalidated: false,
          abortController:
            typeof AbortController === 'function'
              ? new AbortController()
              : null
        };

        request.context = {
          requestId: ++requestSequence,
          legIndex: current.legIndex,
          stepIndex: current.stepIndex,
          instructionIndex: record.instructionIndex,
          attempt: record.failures + 1,

          signal: request.abortController
            ? request.abortController.signal
            : undefined,

          isCurrent: function () {
            return isCurrent(request);
          },

          onPlaybackStart: function () {
            if (isCurrent(request)) {
              record.spoken = true;
            }
          }
        };

        pending = request;

        let result;

        try {
          result = options.play(
            record.announcement,
            request.context
          );
        } catch (_) {
          result = false;
        }

        Promise.resolve(result).then(
          function (succeeded) {
            settle(request, succeeded);
          },
          function () {
            settle(request, false);
          }
        );

        return true;
      }

      function update(snapshot) {
        const validPosition =
          snapshot &&
          Number.isInteger(snapshot.legIndex) &&
          snapshot.legIndex >= 0 &&
          Number.isInteger(snapshot.stepIndex) &&
          snapshot.stepIndex >= 0;

        const validDistance =
          snapshot &&
          Number.isFinite(snapshot.remainingDistanceMeters) &&
          snapshot.remainingDistanceMeters >= 0;

        const regressed =
          validPosition &&
          lastPosition &&
          (
            snapshot.legIndex < lastPosition.legIndex ||
            (
              snapshot.legIndex === lastPosition.legIndex &&
              snapshot.stepIndex < lastPosition.stepIndex
            )
          );

        if (!validPosition || !validDistance || regressed) {
          current = null;
          invalidate('unavailable-progress');
          return false;
        }

        suspendedReason = null;

        lastPosition = {
          legIndex: snapshot.legIndex,
          stepIndex: snapshot.stepIndex
        };

        const stepKey =
          snapshot.legIndex + ':' + snapshot.stepIndex;

        let step = steps.get(stepKey);

        if (!step) {
          step = {
            highestDueRank: -1,
            records: new Map()
          };

          steps.set(stepKey, step);
        }

        const instructions = (
          Array.isArray(snapshot.voiceInstructions)
            ? snapshot.voiceInstructions
            : []
        )
          .map(function (instruction, index) {
            if (
              !instruction ||
              typeof instruction.announcement !== 'string' ||
              !instruction.announcement.trim() ||
              !Number.isFinite(
                instruction.distanceAlongGeometry
              ) ||
              instruction.distanceAlongGeometry < 0
            ) {
              return null;
            }

            return {
              announcement: instruction.announcement,
              distance: instruction.distanceAlongGeometry,
              instructionIndex: index
            };
          })
          .filter(Boolean)
          .sort(function (a, b) {
            return (
              b.distance - a.distance ||
              a.instructionIndex - b.instructionIndex
            );
          });

        let dueRank = -1;

        instructions.forEach(function (instruction, rank) {
          if (
            snapshot.remainingDistanceMeters <=
            instruction.distance
          ) {
            dueRank = rank;
          }
        });

        const eligible =
          dueRank >= step.highestDueRank &&
          dueRank >= 0;

        step.highestDueRank = Math.max(
          step.highestDueRank,
          dueRank
        );

        let record = null;

        if (eligible) {
          const instruction = instructions[dueRank];

          const instructionKey = JSON.stringify([
            instruction.instructionIndex,
            instruction.distance,
            instruction.announcement
          ]);

          record = step.records.get(instructionKey);

          if (!record) {
            record = {
              announcement: instruction.announcement,
              instructionIndex:
                instruction.instructionIndex,
              spoken: false,
              failures: 0,
              retryAt: 0
            };

            step.records.set(instructionKey, record);
          }
        }

        current = {
          stepKey,
          legIndex: snapshot.legIndex,
          stepIndex: snapshot.stepIndex,
          remainingDistanceMeters:
            snapshot.remainingDistanceMeters,
          record
        };

        if (pending && !isCurrent(pending)) {
          invalidate('progress-or-priority-changed');
        }

        return pump();
      }

      function suspend(reason) {
        suspendedReason = reason || 'suspended';
        current = null;
        invalidate(suspendedReason);
      }

      function reset(reason) {
        generation += 1;
        steps.clear();
        lastPosition = null;
        suspend(reason || 'reset');
      }

      function getState() {
        return {
          generation,
          suspendedReason,

          current: current
            ? {
                legIndex: current.legIndex,
                stepIndex: current.stepIndex,
                remainingDistanceMeters:
                  current.remainingDistanceMeters,
                instructionIndex: current.record
                  ? current.record.instructionIndex
                  : null
              }
            : null,

          pending: pending
            ? {
                requestId: pending.context.requestId,
                legIndex: pending.context.legIndex,
                stepIndex: pending.context.stepIndex,
                instructionIndex:
                  pending.context.instructionIndex,
                invalidated: pending.invalidated
              }
            : null
        };
      }

      return {
        update,
        suspend,
        reset,
        getState
      };
    }

    return {
      createController
    };
  }
);
