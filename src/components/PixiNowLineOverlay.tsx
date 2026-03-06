import React, { useCallback, useEffect, useRef } from 'react';
import { Application, extend } from '@pixi/react';
import { Graphics } from 'pixi.js';
import { Visualizer } from '@/core';
import type { Metronome } from '@/core';
import { cn } from '@/lib/utils';

interface PixiTimingOverlayProps {
  metronome: Metronome;
  width: number;
  height: number;
  showVerticalGrid?: boolean;
  showNowLine?: boolean;
  horizontalLines?: number[];
  className?: string;
}

const DIV_COLOR = 0xbbbbbb;
const SUBDIV_COLOR = 0x666666;
const NOW_LINE_COLOR = 0x4ade80;

extend({ Graphics });

export function PixiTimingOverlay({
  metronome: m,
  width,
  height,
  showVerticalGrid = true,
  showNowLine = true,
  horizontalLines = [],
  className,
}: PixiTimingOverlayProps) {
  const mAny = m as any;
  const visualizerRef = useRef(new Visualizer({ metronome: mAny }));
  const frameRef = useRef<number | null>(null);
  const nowLineRef = useRef<any>(null);
  const beats = m.opts.beats;
  const subDivs = m.opts.subDivs;
  const swing = m.opts.swing;
  const barTime = m.barTime;
  const gridTimes = m.gridTimes;
  const visualizerSignature = `${m.opts.beats}:${m.opts.subDivs}:${m.opts.swing}:${width}:${height}`;

  const cancelDraw = useCallback(() => {
    if (frameRef.current === null) {
      return;
    }
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const draw = useCallback(
    function drawFrame() {
      if (!mAny.started) {
        frameRef.current = null;
        return;
      }
      if (!nowLineRef.current || !showNowLine) {
        frameRef.current = window.requestAnimationFrame(drawFrame);
        return;
      }

      visualizerRef.current.update();
      nowLineRef.current.x = visualizerRef.current.progress * width;
      frameRef.current = window.requestAnimationFrame(drawFrame);
    },
    [mAny.started, showNowLine, width],
  );

  useEffect(() => {
    cancelDraw();
    if (mAny.started && showNowLine) {
      if (nowLineRef.current) {
        nowLineRef.current.x = 0;
      }
      visualizerRef.current.start();
      frameRef.current = window.requestAnimationFrame(draw);
    } else {
      if (nowLineRef.current) {
        nowLineRef.current.x = 0;
      }
      visualizerRef.current.stop();
    }

    return cancelDraw;
  }, [cancelDraw, draw, mAny.started, showNowLine, visualizerSignature]);

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-10 overflow-hidden', className)}>
      <Application
        key={visualizerSignature}
        width={width}
        height={height}
        antialias={false}
        autoDensity
        resolution={1}
        roundPixels
        backgroundAlpha={0}
      >
        <pixiGraphics
          draw={g => {
            g.clear();
            if (!showVerticalGrid || !barTime) {
              return;
            }

            gridTimes.forEach((t: number, i: number) => {
              const x = (t / barTime) * width;
              const isSubDiv = i % subDivs > 0;
              g.setStrokeStyle({ width: 1, color: isSubDiv ? SUBDIV_COLOR : DIV_COLOR });
              g.moveTo(x, 0);
              g.lineTo(x, height);
              g.stroke();
            });

            horizontalLines.forEach(y => {
              g.setStrokeStyle({ width: 1, color: DIV_COLOR });
              g.moveTo(0, y);
              g.lineTo(width, y);
              g.stroke();
            });
          }}
        />

        <pixiGraphics
          ref={nowLineRef}
          draw={g => {
            g.clear();
            if (!showNowLine) {
              return;
            }
            g.setStrokeStyle({ width: 6, color: NOW_LINE_COLOR, alpha: 0.18 });
            g.moveTo(0, 0);
            g.lineTo(0, height);
            g.stroke();
            g.setStrokeStyle({ width: 1, color: NOW_LINE_COLOR, alpha: 1 });
            g.moveTo(0, 0);
            g.lineTo(0, height);
            g.stroke();
          }}
        />
      </Application>
    </div>
  );
}
