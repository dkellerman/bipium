/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useCallback } from 'react';
import { Application, extend } from '@pixi/react';
import { Text as PixiText } from 'pixi.js';
import { Visualizer } from '@/core';
import type { Metronome } from '@/core';
import { isEditableEventTarget } from '@/lib/utils';
import { PixiTimingOverlay } from './PixiNowLineOverlay';

interface DefaultVisualizerProps {
  id?: string;
  metronome: Metronome;
  width?: number;
  height?: number;
  showGrid?: boolean;
  showNow?: boolean;
  showCount?: boolean;
  showClicks?: boolean;
}

const incorrectNoteColor = '#ff0000';
const correctNoteColor = '#00ff00';

const countFont = {
  fill: '#ffffff',
  fontFamily: 'sans-serif',
};

const descriptionFont = {
  fill: '#ffffff',
  fontFamily: 'sans-serif',
  fontSize: 18,
  fontWeight: 'bold' as any,
};

const touchEnabled = 'ontouchstart' in window;

const DEFAULT_DESC_TEXT = touchEnabled
  ? 'Tap box on beat to play along'
  : 'Press Ctrl key on beat to tap along';

extend({ Text: PixiText });

export function DefaultVisualizer({
  metronome: m,
  width = 350,
  height = 100,
  showGrid = true,
  showNow = true,
  showCount = true,
  showClicks = true,
}: DefaultVisualizerProps) {
  const mAny = m as any;
  const v = useRef(new Visualizer({ metronome: mAny }));
  const frameRef = useRef<number | null>(null);
  const countRef = useRef<any>(null);
  const descRef = useRef<any>(null);
  const beats = m.opts.beats;
  const subDivs = m.opts.subDivs;
  const swing = m.opts.swing;
  const gridSignature = `${beats}:${subDivs}:${swing}:${width}:${height}`;

  const centerTextAt = (textNode: any, centerX: number, centerY: number) => {
    if (!textNode?.getLocalBounds) return;
    const bounds = textNode.getLocalBounds();
    textNode.x = Math.round(centerX - (bounds.x + bounds.width / 2));
    textNode.y = Math.round(centerY - (bounds.y + bounds.height / 2));
  };

  useEffect(() => {
    countRef.current?.anchor?.set?.(0);
    descRef.current?.anchor?.set?.(0);
    if (countRef.current) {
      countRef.current.resolution = 1;
      countRef.current.roundPixels = true;
    }
    if (descRef.current) {
      descRef.current.resolution = 1;
      descRef.current.roundPixels = true;
    }
    centerTextAt(countRef.current, width / 2, height / 2 - 10);
    centerTextAt(descRef.current, width / 2, height - 20);
  }, [width, height]);

  const cancelDraw = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleUserClick = (event: any) => {
      if (!mAny.started) return;
      if (event.type === 'touchstart' && event.target?.nodeName !== 'CANVAS') return;
      if (event.type === 'keydown' && isEditableEventTarget(event.target)) return;
      if (event.type === 'keydown' && event.key !== 'Control') return;
      v.current.userClicks.push(mAny.now);
      mAny.opts?.clicker?.click();
    };
    window.addEventListener('keydown', handleUserClick);
    window.addEventListener('touchstart', handleUserClick);

    return () => {
      window.removeEventListener('keydown', handleUserClick);
      window.removeEventListener('touchstart', handleUserClick);
    };
  }, []);

  const draw = useCallback(
    function drawFrame() {
      if (!mAny.started) {
        frameRef.current = null;
        return;
      }
      if (!countRef.current || !descRef.current) {
        frameRef.current = window.requestAnimationFrame(drawFrame);
        return;
      }

      v.current.update();

      if (showCount) {
        countRef.current.text = v.current.count.join('-');
      } else {
        countRef.current.text = '';
      }
      centerTextAt(countRef.current, width / 2, height / 2 - 10);

      if (showClicks && v.current.qType) {
        const t = v.current.qType;
        if (t === 'early') {
          descRef.current.text = 'Early';
          descRef.current.style.fill = incorrectNoteColor;
        } else if (t === 'late') {
          descRef.current.text = 'Late';
          descRef.current.style.fill = incorrectNoteColor;
        } else if (t === 'ontime') {
          descRef.current.text = 'On time!';
          descRef.current.style.fill = correctNoteColor;
        }
      }
      centerTextAt(descRef.current, width / 2, height - 20);

      frameRef.current = window.requestAnimationFrame(drawFrame);
    },
    [mAny.started, mAny.barTime, mAny.opts?.bpm, showClicks, showCount, width],
  );

  useEffect(() => {
    cancelDraw();
    if (mAny.started) {
      if (descRef.current) {
        descRef.current.text = showClicks ? DEFAULT_DESC_TEXT : '';
      }
      v.current.start();
      frameRef.current = window.requestAnimationFrame(draw);
    } else {
      if (descRef.current) {
        descRef.current.text = '';
      }
      if (countRef.current) {
        countRef.current.text = '';
      }
      v.current.stop();
    }
  }, [cancelDraw, draw, mAny.started, gridSignature, showClicks]);

  useEffect(() => cancelDraw, [cancelDraw]);

  return (
    <>
      {mAny && (
        <div className="relative h-full w-full">
          <PixiTimingOverlay
            metronome={m}
            width={width}
            height={height}
            showVerticalGrid={showGrid}
            showNowLine={showNow}
          />

          <Application
            key={gridSignature}
            width={width}
            height={height}
            antialias={false}
            autoDensity
            resolution={1}
            roundPixels
            backgroundAlpha={0}
          >
            {React.createElement('pixiText' as any, {
              ref: countRef,
              style: { ...countFont, fontSize: Math.round(height * 0.7) },
            })}

            {React.createElement('pixiText' as any, {
              ref: descRef,
              style: descriptionFont,
            })}
          </Application>
        </div>
      )}
    </>
  );
}
