"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBipiumRuntimeApi = exports.createBipiumSchemas = exports.BIPIUM_API_DEFAULT_CONFIG = exports.API_DEFAULT_CONFIG = exports.BIPIUM_API_DISCOVERY = exports.API_DISCOVERY = exports.BIPIUM_API_VERSION = exports.API_VERSION = void 0;
exports.createEmptyDrumLoopPattern = createEmptyDrumLoopPattern;
exports.seedDrumLoopPattern = seedDrumLoopPattern;
exports.remapDrumLoopPattern = remapDrumLoopPattern;
exports.resolveDrumLoopSounds = resolveDrumLoopSounds;
exports.createSchemas = createSchemas;
exports.mergeConfig = mergeConfig;
exports.validateConfig = validateConfig;
exports.fromQuery = fromQuery;
exports.toQuery = toQuery;
exports.createRuntimeApi = createRuntimeApi;
exports.installWindowBpm = installWindowBpm;
const query_string_1 = __importDefault(require("query-string"));
const zod_1 = require("zod");
const types_1 = require("./types");
exports.API_VERSION = 1;
exports.BIPIUM_API_VERSION = exports.API_VERSION;
exports.API_DISCOVERY = {
    ui: '/api',
    markdown: '/api.md',
    llms: '/llms.txt',
    agents: '/agents.txt',
};
exports.BIPIUM_API_DISCOVERY = exports.API_DISCOVERY;
function createLane(stepCount) {
    return Array.from({ length: stepCount }, () => false);
}
function getStepCount({ beats, subDivs }) {
    return Math.max(1, beats * subDivs);
}
function createEmptyDrumLoopPattern(timing) {
    const stepCount = getStepCount(timing);
    return {
        kick: createLane(stepCount),
        hat: createLane(stepCount),
        snare: createLane(stepCount),
    };
}
function getStepIndex({ beat, subDiv, subDivs, }) {
    return (beat - 1) * subDivs + (subDiv - 1);
}
function isBeatAlignedStep(stepIndex, subDivs) {
    return stepIndex % subDivs === 0;
}
function getStepPositions({ beats, subDivs, swing }) {
    const totalSteps = getStepCount({ beats, subDivs, swing });
    const base = 1 / totalSteps;
    const swingOffset = base * (swing / 100);
    return Array.from({ length: totalSteps }, (_, index) => {
        const position = index * base;
        return index % 2 === 1 ? position + swingOffset : position;
    });
}
function nearestIndex(target, positions) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    positions.forEach((position, index) => {
        const distance = Math.abs(position - target);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    });
    return bestIndex;
}
function seedDrumLoopPattern(timing) {
    const pattern = createEmptyDrumLoopPattern(timing);
    const midpointBeat = Math.ceil(timing.beats / 2) + 1;
    for (let stepIndex = 0; stepIndex < getStepCount(timing); stepIndex += 1) {
        const beat = Math.floor(stepIndex / timing.subDivs) + 1;
        const subDiv = (stepIndex % timing.subDivs) + 1;
        pattern.hat[stepIndex] = true;
        if (beat === 1 && subDiv === 1) {
            pattern.kick[stepIndex] = true;
        }
        if (beat === midpointBeat && subDiv === 1) {
            pattern.snare[stepIndex] = true;
        }
    }
    return pattern;
}
function remapDrumLoopPattern(pattern, fromTiming, toTiming) {
    const next = createEmptyDrumLoopPattern(toTiming);
    const fromPositions = getStepPositions(fromTiming);
    const toPositions = getStepPositions(toTiming);
    types_1.DRUM_LOOP_LANES.forEach(lane => {
        pattern[lane].forEach((active, index) => {
            var _a;
            if (!active)
                return;
            const targetIndex = nearestIndex((_a = fromPositions[index]) !== null && _a !== void 0 ? _a : 0, toPositions);
            next[lane][targetIndex] = true;
        });
    });
    return next;
}
function toFinalSoundSpec(soundSpec) {
    if (!soundSpec)
        return null;
    if (Array.isArray(soundSpec))
        return soundSpec;
    return [soundSpec, 1.0, 0.05];
}
function resolveDrumLoopSounds(click, pattern, sounds) {
    const stepIndex = getStepIndex(click);
    const resolved = [];
    if (pattern.kick[stepIndex]) {
        const kickSound = toFinalSoundSpec(sounds.bar || sounds.beat);
        if (kickSound)
            resolved.push(kickSound);
    }
    if (pattern.snare[stepIndex]) {
        const snareSound = toFinalSoundSpec(sounds.half || sounds.beat);
        if (snareSound)
            resolved.push(snareSound);
    }
    if (pattern.hat[stepIndex]) {
        const isBeat = isBeatAlignedStep(stepIndex, click.subDivs);
        const hatSound = toFinalSoundSpec(isBeat ? sounds.beat || sounds.subDiv : sounds.subDiv || sounds.beat);
        if (hatSound)
            resolved.push(hatSound);
    }
    return resolved;
}
function getLoopTiming(config) {
    return {
        beats: config.beats,
        subDivs: config.playSubDivs ? config.subDivs : 1,
        swing: config.playSubDivs && config.subDivs % 2 === 0 ? config.swing : 0,
    };
}
function cloneLoopPattern(pattern) {
    return {
        kick: [...pattern.kick],
        hat: [...pattern.hat],
        snare: [...pattern.snare],
    };
}
function cloneApiConfig(config) {
    return Object.assign(Object.assign({}, config), { soundUrls: Object.assign({}, config.soundUrls), loopPattern: cloneLoopPattern(config.loopPattern) });
}
function createDefaultLoopPattern() {
    return seedDrumLoopPattern({ beats: 4, subDivs: 1, swing: 0 });
}
exports.API_DEFAULT_CONFIG = {
    bpm: 80,
    beats: 4,
    subDivs: 1,
    playSubDivs: true,
    swing: 0,
    soundPack: 'drumkit',
    volume: 35,
    loopMode: false,
    loopRepeats: 0,
    soundUrls: {},
    loopPattern: createDefaultLoopPattern(),
};
exports.BIPIUM_API_DEFAULT_CONFIG = exports.API_DEFAULT_CONFIG;
function firstValue(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
function parseBooleanLike(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number') {
        if (value === 1)
            return true;
        if (value === 0)
            return false;
        return undefined;
    }
    if (typeof value !== 'string')
        return undefined;
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y', 'on'].includes(normalized))
        return true;
    if (['false', 'f', '0', 'no', 'n', 'off'].includes(normalized))
        return false;
    return undefined;
}
function parseNumberLike(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function numberFieldSchema(fieldName, min, max, integer = false) {
    return zod_1.z
        .preprocess(value => { var _a; return (_a = parseNumberLike(value)) !== null && _a !== void 0 ? _a : value; }, zod_1.z.number())
        .refine(value => (integer ? Number.isInteger(value) : true), {
        message: `${fieldName} must be an integer.`,
    })
        .refine(value => value >= min && value <= max, {
        message: `${fieldName} must be between ${min} and ${max}.`,
    });
}
function createSoundPackSchema(knownSoundPacks) {
    return zod_1.z
        .string()
        .min(1, 'soundPack must be a non-empty string.')
        .refine(value => knownSoundPacks.has(value), {
        message: `soundPack must be one of: ${Array.from(knownSoundPacks).join(', ')}.`,
    });
}
function createPlaySubDivsSchema() {
    return zod_1.z.preprocess(value => { var _a; return (_a = parseBooleanLike(value)) !== null && _a !== void 0 ? _a : value; }, zod_1.z.boolean());
}
function createLoopModeSchema() {
    return zod_1.z.preprocess(value => { var _a; return (_a = parseBooleanLike(value)) !== null && _a !== void 0 ? _a : value; }, zod_1.z.boolean());
}
function createLoopRepeatsSchema() {
    return numberFieldSchema('loopRepeats', 0, 128, true);
}
function createLoopPatternSchema() {
    return zod_1.z
        .object({
        kick: zod_1.z.array(zod_1.z.boolean()),
        hat: zod_1.z.array(zod_1.z.boolean()),
        snare: zod_1.z.array(zod_1.z.boolean()),
    })
        .strict();
}
function createSoundUrlsSchema() {
    return zod_1.z
        .object({
        bar: zod_1.z.string().min(1).optional(),
        beat: zod_1.z.string().min(1).optional(),
        half: zod_1.z.string().min(1).optional(),
        subDiv: zod_1.z.string().min(1).optional(),
        user: zod_1.z.string().min(1).optional(),
    })
        .strict();
}
const SOUND_URL_QUERY_KEYS = {
    bar: 'soundBarUrl',
    beat: 'soundBeatUrl',
    half: 'soundHalfUrl',
    subDiv: 'soundSubDivUrl',
    user: 'soundUserUrl',
};
function validateLoopPatternLength(config) {
    return config.beats * (config.playSubDivs ? config.subDivs : 1);
}
function encodeLoopLane(values) {
    return values.map(active => (active ? '1' : '0')).join('');
}
function decodeLoopLane(value) {
    if (typeof value !== 'string')
        return null;
    const normalized = value.trim();
    if (!normalized)
        return [];
    if (!/^[01]+$/.test(normalized))
        return null;
    return normalized.split('').map(char => char === '1');
}
function parseSoundUrlsFromQuery(parsed) {
    const soundUrls = {};
    Object.keys(SOUND_URL_QUERY_KEYS).forEach(slot => {
        const key = SOUND_URL_QUERY_KEYS[slot];
        if (!Object.prototype.hasOwnProperty.call(parsed, key))
            return;
        const value = firstValue(parsed[key]);
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`Invalid ${key} value.`);
        }
        soundUrls[slot] = value;
    });
    return soundUrls;
}
function parseLoopPatternFromQuery(parsed, config) {
    const loopLaneQueryKeys = {
        kick: 'loopKick',
        hat: 'loopHat',
        snare: 'loopSnare',
    };
    const laneValues = types_1.DRUM_LOOP_LANES.map(lane => {
        const key = loopLaneQueryKeys[lane];
        if (!Object.prototype.hasOwnProperty.call(parsed, key))
            return null;
        return {
            lane,
            value: decodeLoopLane(firstValue(parsed[key])),
        };
    }).filter(Boolean);
    if (!laneValues.length)
        return undefined;
    const pattern = cloneLoopPattern(config.loopPattern);
    laneValues.forEach(({ lane, value }) => {
        if (!value) {
            throw new Error(`Invalid ${loopLaneQueryKeys[lane]} bitstring.`);
        }
        pattern[lane] = value;
    });
    return pattern;
}
function formatZodError(error) {
    const firstIssue = error.issues[0];
    if (!firstIssue) {
        return 'Invalid config.';
    }
    if (!firstIssue.path.length) {
        return firstIssue.message;
    }
    return `${firstIssue.path.join('.')}: ${firstIssue.message}`;
}
function createSchemas(knownSoundPacks) {
    const configBase = zod_1.z
        .object({
        bpm: numberFieldSchema('bpm', 20, 320),
        beats: numberFieldSchema('beats', 1, 12, true),
        subDivs: numberFieldSchema('subDivs', 1, 8, true),
        playSubDivs: createPlaySubDivsSchema(),
        swing: numberFieldSchema('swing', 0, 100),
        soundPack: createSoundPackSchema(knownSoundPacks),
        volume: numberFieldSchema('volume', 0, 100),
        soundUrls: createSoundUrlsSchema(),
        loopMode: createLoopModeSchema(),
        loopRepeats: createLoopRepeatsSchema(),
        loopPattern: createLoopPatternSchema(),
    })
        .strict();
    const config = configBase.superRefine((value, ctx) => {
        const stepCount = validateLoopPatternLength(value);
        types_1.DRUM_LOOP_LANES.forEach(lane => {
            if (value.loopPattern[lane].length !== stepCount) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['loopPattern', lane],
                    message: `loopPattern.${lane} must contain ${stepCount} steps.`,
                });
            }
        });
    });
    const configPatch = configBase.partial().strict();
    const schemaJson = {
        config: zod_1.z.toJSONSchema(config),
        configPatch: zod_1.z.toJSONSchema(configPatch),
    };
    return {
        config,
        configPatch,
        schemaJson,
    };
}
exports.createBipiumSchemas = createSchemas;
function mergeConfig(base, patchInput, schemas) {
    const patchResult = schemas.configPatch.safeParse(patchInput);
    if (!patchResult.success) {
        throw new Error(formatZodError(patchResult.error));
    }
    const merged = Object.assign(Object.assign(Object.assign({}, base), patchResult.data), { soundUrls: patchResult.data.soundUrls
            ? Object.assign(Object.assign({}, base.soundUrls), patchResult.data.soundUrls) : Object.assign({}, base.soundUrls), loopPattern: patchResult.data.loopPattern
            ? cloneLoopPattern(patchResult.data.loopPattern)
            : cloneLoopPattern(base.loopPattern) });
    const baseTiming = getLoopTiming(base);
    const mergedTiming = getLoopTiming(merged);
    const timingChanged = baseTiming.beats !== mergedTiming.beats ||
        baseTiming.subDivs !== mergedTiming.subDivs ||
        baseTiming.swing !== mergedTiming.swing;
    if (timingChanged && !Object.prototype.hasOwnProperty.call(patchResult.data, 'loopPattern')) {
        merged.loopPattern = remapDrumLoopPattern(base.loopPattern, baseTiming, mergedTiming);
    }
    const mergedResult = schemas.config.safeParse(merged);
    if (!mergedResult.success) {
        throw new Error(formatZodError(mergedResult.error));
    }
    return cloneApiConfig(mergedResult.data);
}
function validateConfig(base, input, schemas) {
    try {
        return {
            ok: true,
            value: mergeConfig(base, input, schemas),
        };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Invalid config.',
        };
    }
}
function fromQuery(base, query, schemas) {
    const raw = typeof query === 'string' ? query : window.location.search;
    const queryString = raw.includes('://') ? new URL(raw).search : raw;
    const parsed = query_string_1.default.parse(queryString.startsWith('?') ? queryString : `?${queryString}`);
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(parsed, 'bpm'))
        patch.bpm = firstValue(parsed.bpm);
    if (Object.prototype.hasOwnProperty.call(parsed, 'beats'))
        patch.beats = firstValue(parsed.beats);
    if (Object.prototype.hasOwnProperty.call(parsed, 'subDivs')) {
        patch.subDivs = firstValue(parsed.subDivs);
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'playSubDivs')) {
        patch.playSubDivs = firstValue(parsed.playSubDivs);
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'swing'))
        patch.swing = firstValue(parsed.swing);
    if (Object.prototype.hasOwnProperty.call(parsed, 'soundPack')) {
        patch.soundPack = firstValue(parsed.soundPack);
    }
    const soundUrls = parseSoundUrlsFromQuery(parsed);
    if (Object.keys(soundUrls).length > 0) {
        patch.soundUrls = soundUrls;
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'volume')) {
        patch.volume = firstValue(parsed.volume);
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'loopMode')) {
        patch.loopMode = firstValue(parsed.loopMode);
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'loopRepeats')) {
        patch.loopRepeats = firstValue(parsed.loopRepeats);
    }
    const partialConfig = mergeConfig(base, patch, schemas);
    const loopPattern = parseLoopPatternFromQuery(parsed, partialConfig);
    if (loopPattern) {
        patch.loopPattern = loopPattern;
    }
    return mergeConfig(base, patch, schemas);
}
function toQuery(config) {
    const params = {
        bpm: Number(config.bpm),
        beats: Number(config.beats),
        playSubDivs: Boolean(config.playSubDivs),
        volume: Number(config.volume),
    };
    if (config.playSubDivs) {
        params.subDivs = Number(config.subDivs);
        params.swing = Number(config.swing);
    }
    if (config.soundPack !== 'defaults') {
        params.soundPack = config.soundPack;
    }
    Object.keys(SOUND_URL_QUERY_KEYS).forEach(slot => {
        const value = config.soundUrls[slot];
        if (value) {
            params[SOUND_URL_QUERY_KEYS[slot]] = value;
        }
    });
    if (config.loopMode) {
        params.loopMode = true;
        params.loopKick = encodeLoopLane(config.loopPattern.kick);
        params.loopHat = encodeLoopLane(config.loopPattern.hat);
        params.loopSnare = encodeLoopLane(config.loopPattern.snare);
    }
    if (config.loopRepeats > 0) {
        params.loopRepeats = Number(config.loopRepeats);
    }
    const serialized = query_string_1.default.stringify(params);
    return serialized ? `?${serialized}` : '';
}
function createRuntimeApi(controls) {
    const schemas = createSchemas(new Set(controls.getSoundPacks()));
    const mergeWithCurrent = (input) => mergeConfig(controls.getConfig(), input, schemas);
    return {
        version: exports.API_VERSION,
        entrypoint: 'window.bpm',
        discovery: exports.API_DISCOVERY,
        defaults: cloneApiConfig(exports.API_DEFAULT_CONFIG),
        schemas: {
            config: schemas.config,
            configPatch: schemas.configPatch,
        },
        schemaJson: schemas.schemaJson,
        getSchemaJson() {
            return schemas.schemaJson;
        },
        start(bpm, beats, subDivs, swing, soundPack, volume) {
            const patch = {};
            if (bpm !== undefined)
                patch.bpm = bpm;
            if (beats !== undefined)
                patch.beats = beats;
            if (subDivs !== undefined) {
                patch.subDivs = subDivs;
                patch.playSubDivs = true;
            }
            if (swing !== undefined) {
                patch.swing = swing;
                patch.playSubDivs = true;
            }
            if (soundPack !== undefined)
                patch.soundPack = soundPack;
            if (volume !== undefined)
                patch.volume = volume;
            if (Object.keys(patch).length > 0) {
                const next = mergeWithCurrent(patch);
                controls.applyConfig(next);
            }
            controls.startPlayback();
            return cloneApiConfig(controls.getConfig());
        },
        stop() {
            controls.stopPlayback();
        },
        toggle() {
            return controls.togglePlayback();
        },
        isStarted() {
            return controls.isPlaying();
        },
        isLoopMode() {
            return controls.getConfig().loopMode;
        },
        getLoopRepeats() {
            return controls.getConfig().loopRepeats;
        },
        getSoundUrls() {
            return Object.assign({}, controls.getConfig().soundUrls);
        },
        getConfig() {
            return cloneApiConfig(controls.getConfig());
        },
        setConfig(partial) {
            const next = mergeWithCurrent(partial);
            controls.applyConfig(next);
            return cloneApiConfig(controls.getConfig());
        },
        getLoopPattern() {
            return cloneLoopPattern(controls.getConfig().loopPattern);
        },
        setLoopMode(enabled) {
            const next = mergeWithCurrent({ loopMode: enabled });
            controls.applyConfig(next);
            return cloneApiConfig(controls.getConfig());
        },
        setLoopRepeats(repeats) {
            const next = mergeWithCurrent({ loopRepeats: repeats });
            controls.applyConfig(next);
            return cloneApiConfig(controls.getConfig());
        },
        setSoundUrls(soundUrls) {
            const next = mergeWithCurrent({ soundUrls });
            controls.applyConfig(next);
            return cloneApiConfig(controls.getConfig());
        },
        setLoopPattern(pattern) {
            const next = mergeWithCurrent({ loopPattern: pattern });
            controls.applyConfig(next);
            return cloneApiConfig(controls.getConfig());
        },
        resetLoopPattern() {
            const current = controls.getConfig();
            const next = mergeWithCurrent({
                loopPattern: seedDrumLoopPattern(getLoopTiming(current)),
            });
            controls.applyConfig(next);
            return cloneApiConfig(controls.getConfig());
        },
        validateConfig(input) {
            const result = validateConfig(controls.getConfig(), input, schemas);
            return result.ok ? { ok: true, value: cloneApiConfig(result.value) } : result;
        },
        fromQuery(query) {
            return fromQuery(controls.getConfig(), query, schemas);
        },
        toQuery(config) {
            const next = config ? mergeWithCurrent(config) : controls.getConfig();
            return toQuery(next);
        },
        applyQuery(query) {
            const next = fromQuery(controls.getConfig(), query, schemas);
            controls.applyConfig(next);
            return cloneApiConfig(controls.getConfig());
        },
        tap() {
            controls.tap();
        },
        getSoundPacks() {
            return controls.getSoundPacks();
        },
        now() {
            return controls.now();
        },
    };
}
exports.createBipiumRuntimeApi = createRuntimeApi;
function installWindowBpm(runtime, target = globalThis) {
    const previous = target.bpm;
    const next = previous && typeof previous === 'object'
        ? Object.assign(Object.assign({}, previous), runtime) : Object.assign({}, runtime);
    target.bpm = next;
    return () => {
        if (target.bpm !== next)
            return;
        if (previous && typeof previous === 'object') {
            target.bpm = previous;
            return;
        }
        delete target.bpm;
    };
}
