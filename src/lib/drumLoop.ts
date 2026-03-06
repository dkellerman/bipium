import type { Click, FinalSoundSpec, SoundPack, SoundSpec } from '@/core/types';

export const DRUM_LOOP_LANES = ['kick', 'hat', 'snare'] as const;

export type DrumLoopLane = (typeof DRUM_LOOP_LANES)[number];

export interface DrumLoopTiming {
  beats: number;
  subDivs: number;
  swing: number;
}

export type DrumLoopPattern = Record<DrumLoopLane, boolean[]>;

function createLane(stepCount: number) {
  return Array.from({ length: stepCount }, () => false);
}

export function getStepCount({ beats, subDivs }: DrumLoopTiming) {
  return Math.max(1, beats * subDivs);
}

export function createEmptyDrumLoopPattern(timing: DrumLoopTiming): DrumLoopPattern {
  const stepCount = getStepCount(timing);
  return {
    kick: createLane(stepCount),
    hat: createLane(stepCount),
    snare: createLane(stepCount),
  };
}

export function getStepIndex({
  beat,
  subDiv,
  subDivs,
}: Pick<Click, 'beat' | 'subDiv' | 'subDivs'>) {
  return (beat - 1) * subDivs + (subDiv - 1);
}

export function isBeatAlignedStep(stepIndex: number, subDivs: number) {
  return stepIndex % subDivs === 0;
}

export function getStepPositions({ beats, subDivs, swing }: DrumLoopTiming) {
  const totalSteps = getStepCount({ beats, subDivs, swing });
  const base = 1 / totalSteps;
  const swingOffset = base * (swing / 100);

  return Array.from({ length: totalSteps }, (_, index) => {
    const position = index * base;
    return index % 2 === 1 ? position + swingOffset : position;
  });
}

export function seedDrumLoopPattern(timing: DrumLoopTiming): DrumLoopPattern {
  const pattern = createEmptyDrumLoopPattern(timing);
  const midpointBeat = Math.ceil(timing.beats / 2) + 1;

  for (let stepIndex = 0; stepIndex < getStepCount(timing); stepIndex += 1) {
    const beat = Math.floor(stepIndex / timing.subDivs) + 1;
    const subDiv = (stepIndex % timing.subDivs) + 1;

    if (beat === 1 && subDiv === 1) {
      pattern.kick[stepIndex] = true;
      continue;
    }

    if (beat === midpointBeat && subDiv === 1) {
      pattern.snare[stepIndex] = true;
      continue;
    }

    pattern.hat[stepIndex] = true;
  }

  return pattern;
}

function nearestIndex(target: number, positions: number[]) {
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

export function remapDrumLoopPattern(
  pattern: DrumLoopPattern,
  fromTiming: DrumLoopTiming,
  toTiming: DrumLoopTiming,
): DrumLoopPattern {
  const next = createEmptyDrumLoopPattern(toTiming);
  const fromPositions = getStepPositions(fromTiming);
  const toPositions = getStepPositions(toTiming);

  DRUM_LOOP_LANES.forEach(lane => {
    pattern[lane].forEach((active, index) => {
      if (!active) return;
      const targetIndex = nearestIndex(fromPositions[index] ?? 0, toPositions);
      next[lane][targetIndex] = true;
    });
  });

  return next;
}

function toFinalSoundSpec(soundSpec?: SoundSpec): FinalSoundSpec | null {
  if (!soundSpec) return null;
  if (Array.isArray(soundSpec)) return soundSpec as FinalSoundSpec;
  return [soundSpec, 1.0, 0.05];
}

export function resolveDrumLoopSounds(
  click: Pick<Click, 'beat' | 'subDiv' | 'subDivs'>,
  pattern: DrumLoopPattern,
  sounds: SoundPack,
): FinalSoundSpec[] {
  const stepIndex = getStepIndex(click);
  const resolved: FinalSoundSpec[] = [];

  if (pattern.kick[stepIndex]) {
    const kickSound = toFinalSoundSpec(sounds.bar || sounds.beat);
    if (kickSound) resolved.push(kickSound);
  }

  if (pattern.snare[stepIndex]) {
    const snareSound = toFinalSoundSpec(sounds.half || sounds.beat);
    if (snareSound) resolved.push(snareSound);
  }

  if (pattern.hat[stepIndex]) {
    const isBeat = isBeatAlignedStep(stepIndex, click.subDivs);
    const hatSound = toFinalSoundSpec(
      isBeat ? sounds.beat || sounds.subDiv : sounds.subDiv || sounds.beat,
    );
    if (hatSound) resolved.push(hatSound);
  }

  return resolved;
}
