(function (root) {
  'use strict';

  const VERSION = 2;
  const MAX_SUPPORTED_VERSION = 2;
  const MAX_FRAMES = 120000;
  const MAX_INPUTS = 200000;
  const MAX_EVENTS = 100000;
  const MAX_VALUE_BYTES = 100000;
  const MAX_TAPE_BYTES = 25000000;

  let mode = 'idle';
  let tape = null;
  let frameIndex = 0;
  let inputIndex = 0;
  let eventIndex = 0;
  let currentFrame = 0;
  let inFrame = false;
  let terminalFrameIssued = false;
  let divergences = [];

  function serialize(value) {
    try {
      const json = JSON.stringify(value === undefined ? null : value);
      return typeof json === 'string' ? json : 'null';
    } catch (error) {
      return null;
    }
  }

  function clone(value, maxBytes) {
    const json = serialize(value);
    if (json === null) return null;
    if (json.length > (maxBytes || MAX_TAPE_BYTES)) {
      throw new RangeError('Replay data exceeds the supported size limit');
    }
    return JSON.parse(json);
  }

  function validFrameIndex(value, frameCount) {
    return Number.isInteger(value) && value >= 0 && value <= frameCount;
  }

  function resetCursors() {
    frameIndex = 0;
    inputIndex = 0;
    eventIndex = 0;
    currentFrame = 0;
    inFrame = false;
    terminalFrameIssued = false;
    divergences = [];
  }

  function start(seed, metadata) {
    const numericSeed = Number(seed);
    if (!Number.isFinite(numericSeed)) throw new TypeError('Replay seed must be finite');
    tape = {
      version: VERSION,
      seed: numericSeed >>> 0,
      metadata: clone(metadata || {}, MAX_VALUE_BYTES) || {},
      frames: [],
      inputs: [],
      events: [],
      outcome: null,
      finished: false
    };
    mode = 'record';
    resetCursors();
    return getTape();
  }

  const isRecording = () => mode === 'record';
  const isPlaying = () => mode === 'playback';
  const isReady = () => mode === 'ready';

  function recordInput(action, data) {
    if (mode !== 'record' || !tape || tape.inputs.length >= MAX_INPUTS) {
      if (mode === 'record' && tape) tape.truncated = true;
      return false;
    }
    const normalizedAction = String(action || '').trim();
    if (!normalizedAction) return false;
    const value = clone(data || {}, MAX_VALUE_BYTES);
    tape.inputs.push({
      frame: inFrame ? currentFrame : tape.frames.length,
      action: normalizedAction,
      data: value || {}
    });
    return true;
  }

  function beginFrame(delta) {
    if (mode !== 'record' || !tape) return false;
    if (tape.frames.length >= MAX_FRAMES) {
      tape.truncated = true;
      return false;
    }
    const value = Number(delta);
    currentFrame = tape.frames.length;
    inFrame = true;
    tape.frames.push(Number.isFinite(value) ? Math.max(0, Math.min(0.06, value)) : 0);
    return true;
  }

  function endFrame() {
    inFrame = false;
  }

  function recordEvent(type, payload) {
    const eventType = String(type || '').trim();
    if (!eventType) return false;
    const value = clone(payload, MAX_VALUE_BYTES);

    if (mode === 'record' && tape) {
      if (tape.events.length >= MAX_EVENTS) {
        tape.truncated = true;
        return false;
      }
      tape.events.push({
        frame: inFrame ? currentFrame : tape.frames.length,
        type: eventType,
        payload: value
      });
      return true;
    }

    if (mode === 'playback' && tape) {
      const expected = tape.events[eventIndex++] || null;
      const actual = { frame: currentFrame, type: eventType, payload: value };
      if (!expected ||
          expected.frame !== actual.frame ||
          expected.type !== actual.type ||
          serialize(expected.payload) !== serialize(actual.payload)) {
        divergences.push({ expected: expected, actual: actual });
      }
      return true;
    }
    return false;
  }

  function validateTape(parsed) {
    if (!parsed || typeof parsed !== 'object') throw new TypeError('Invalid Skyward replay tape');
    if (!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > MAX_SUPPORTED_VERSION) {
      throw new TypeError('Unsupported Skyward replay version');
    }
    if (!Number.isFinite(Number(parsed.seed))) throw new TypeError('Replay tape has an invalid seed');
    if (!Array.isArray(parsed.frames) || !Array.isArray(parsed.inputs) || !Array.isArray(parsed.events)) {
      throw new TypeError('Replay tape is missing frame, input, or event arrays');
    }
    if (parsed.frames.length > MAX_FRAMES || parsed.inputs.length > MAX_INPUTS || parsed.events.length > MAX_EVENTS) {
      throw new RangeError('Replay tape exceeds safety limits');
    }

    for (let i = 0; i < parsed.frames.length; i++) {
      const delta = Number(parsed.frames[i]);
      if (!Number.isFinite(delta) || delta < 0 || delta > 0.25) {
        throw new TypeError('Replay tape contains an invalid frame delta at index ' + i);
      }
    }

    let previousInputFrame = -1;
    parsed.inputs.forEach((input, index) => {
      if (!input || typeof input.action !== 'string' || !input.action ||
          !validFrameIndex(input.frame, parsed.frames.length)) {
        throw new TypeError('Replay tape contains an invalid input at index ' + index);
      }
      if (input.frame < previousInputFrame) throw new TypeError('Replay inputs are not ordered by frame');
      previousInputFrame = input.frame;
    });

    let previousEventFrame = -1;
    parsed.events.forEach((event, index) => {
      if (!event || typeof event.type !== 'string' || !event.type ||
          !validFrameIndex(event.frame, parsed.frames.length)) {
        throw new TypeError('Replay tape contains an invalid event at index ' + index);
      }
      if (event.frame < previousEventFrame) throw new TypeError('Replay events are not ordered by frame');
      previousEventFrame = event.frame;
    });
    return parsed;
  }

  function load(input) {
    let parsed = input;
    if (typeof input === 'string') {
      try {
        parsed = JSON.parse(input);
      } catch (error) {
        throw new TypeError('Replay tape is not valid JSON');
      }
    }
    validateTape(parsed);
    tape = clone(parsed);
    mode = 'ready';
    resetCursors();
    return getTape();
  }

  function getTape() {
    return tape ? clone(tape) : null;
  }

  function exportTape() {
    return tape ? JSON.stringify(tape) : null;
  }

  function startPlayback() {
    if (mode !== 'ready' || !tape) throw new Error('Load a replay tape before playback');
    mode = 'playback';
    resetCursors();
    return status();
  }

  function nextFrame() {
    if (mode !== 'playback' || !tape) return null;
    if (frameIndex < tape.frames.length) {
      currentFrame = frameIndex;
      return { index: frameIndex, dt: tape.frames[frameIndex++] };
    }

    const trailingInput = inputIndex < tape.inputs.length &&
      tape.inputs[inputIndex].frame <= tape.frames.length;
    const trailingEvent = eventIndex < tape.events.length &&
      tape.events[eventIndex].frame <= tape.frames.length;
    if (!terminalFrameIssued && (trailingInput || trailingEvent)) {
      terminalFrameIssued = true;
      currentFrame = tape.frames.length;
      return { index: currentFrame, dt: 0, terminal: true };
    }

    stopPlayback();
    return null;
  }

  function drainInputsForFrame(index) {
    if (mode !== 'playback' || !tape) return [];
    const due = [];
    while (inputIndex < tape.inputs.length && tape.inputs[inputIndex].frame <= index) {
      due.push(clone(tape.inputs[inputIndex], MAX_VALUE_BYTES));
      inputIndex += 1;
    }
    return due;
  }

  function compareRemaining() {
    if (!tape) return;
    while (eventIndex < tape.events.length) {
      divergences.push({ expected: clone(tape.events[eventIndex], MAX_VALUE_BYTES), actual: null });
      eventIndex += 1;
    }
  }

  function stopPlayback() {
    if (mode === 'playback') {
      compareRemaining();
      mode = 'idle';
      inFrame = false;
    }
    return status();
  }

  function status() {
    return {
      mode: mode,
      version: tape ? tape.version : null,
      seed: tape ? tape.seed : null,
      frames: tape ? tape.frames.length : 0,
      inputs: tape ? tape.inputs.length : 0,
      events: tape ? tape.events.length : 0,
      playbackFrame: frameIndex,
      eventCursor: eventIndex,
      inputCursor: inputIndex,
      divergences: divergences.length,
      finished: !!(tape && tape.finished),
      truncated: !!(tape && tape.truncated)
    };
  }

  function finish(outcome) {
    if (mode === 'record' && tape) {
      tape.outcome = clone(outcome || {}, MAX_VALUE_BYTES);
      tape.finished = true;
      mode = 'idle';
      inFrame = false;
      return status();
    }
    if (mode === 'playback' && tape) {
      const actual = clone(outcome || {}, MAX_VALUE_BYTES);
      if (serialize(actual) !== serialize(tape.outcome)) {
        divergences.push({
          expectedOutcome: clone(tape.outcome, MAX_VALUE_BYTES),
          actualOutcome: actual
        });
      }
      return stopPlayback();
    }
    return status();
  }

  const api = {
    version: VERSION,
    start: start,
    load: load,
    getTape: getTape,
    export: exportTape,
    startPlayback: startPlayback,
    nextFrame: nextFrame,
    drainInputsForFrame: drainInputsForFrame,
    recordInput: recordInput,
    recordEvent: recordEvent,
    beginFrame: beginFrame,
    endFrame: endFrame,
    finish: finish,
    stopPlayback: stopPlayback,
    isRecording: isRecording,
    isPlaying: isPlaying,
    isReady: isReady,
    status: status
  };

  root.SkywardReplay = api;
  if (root.SkywardEvents && typeof root.SkywardEvents.on === 'function') {
    root.SkywardEvents.on('*', function (event) {
      api.recordEvent(event.type, event.payload);
    });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
