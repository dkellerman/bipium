/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useCallback } from 'react';
import { Application, extend } from '@pixi/react';
import { Graphics, Text as PixiText } from 'pixi.js';
import { Visualizer } from './core';
import type { DefaultVisualizerProps } from './types';

const divColor = 0xbbbbbb;
const subDivColor = 0x666666;
const nowLineColor = 0x00ff00;
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

extend({ Graphics, Text: PixiText });

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
  const nowLineRef = useRef<any>(null);
  const countRef = useRef<any>(null);
  const gridRef = useRef<any>(null);
  const descRef = useRef<any>(null);

  const centerTextAt = (textNode: any, centerX: number, centerY: number) => {
    if (!textNode?.getLocalBounds) return;
    const bounds = textNode.getLocalBounds();
    textNode.x = centerX - (bounds.x + bounds.width / 2);
    textNode.y = centerY - (bounds.y + bounds.height / 2);
  };

  useEffect(() => {
    setTimeout(drawGrid, 0);
    mAny.opts.onUpdateOptions = () => {
      drawGrid();
    };
  }, [mAny]);

  useEffect(() => {
    countRef.current?.anchor?.set?.(0);
    descRef.current?.anchor?.set?.(0);
    centerTextAt(countRef.current, width / 2, height / 2 - 10);
    centerTextAt(descRef.current, width / 2, height - 20);
  }, [width, height]);

  useEffect(() => {
    if (!nowLineRef.current || !descRef.current || !countRef.current) return;

    if (mAny.started) {
      nowLineRef.current.x = 0;
      descRef.current.text = DEFAULT_DESC_TEXT;
      v.current.start();
      requestAnimationFrame(draw);
    } else {
      nowLineRef.current.x = 0;
      descRef.current.text = '';
      countRef.current.text = '';
      v.current.stop();
    }
  }, [mAny.started]);

  useEffect(() => {
    const handleUserClick = (event: any) => {
      if (!mAny.started) return;
      if (event.type === 'touchstart' && event.target?.nodeName !== 'CANVAS') return;
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

  const draw = useCallback(() => {
    if (!mAny.started) return;
    if (!nowLineRef.current || !countRef.current || !descRef.current) {
      requestAnimationFrame(draw);
      return;
    }

    v.current.update();

    if (showNow) {
      nowLineRef.current.x = v.current.progress * width;
    }

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

    requestAnimationFrame(draw);
  }, [mAny.started, mAny.barTime, mAny.opts?.bpm]);

  function drawGrid() {
    if (!showGrid) return;
    const g = gridRef.current;
    if (!g) return;
    g.clear();
    mAny.gridTimes?.forEach((t: number, i: number) => {
      const x = (t / mAny.barTime) * width;
      const isSubDiv = i % (mAny.opts?.subDivs || 1) > 0;
      g.setStrokeStyle({ width: 1, color: isSubDiv ? subDivColor : divColor });
      g.moveTo(x, 0);
      g.lineTo(x, height);
      g.stroke();
    });
  }

  return (
    <>
      {mAny && (
        <Application width={width} height={height} antialias autoDensity>
          <pixiGraphics ref={gridRef} draw={() => {}} />

          <pixiGraphics
            ref={nowLineRef}
            draw={g => {
              g.setStrokeStyle({ width: 1, color: nowLineColor, alpha: 1 });
              g.moveTo(0, 0);
              g.lineTo(0, height);
              g.stroke();
            }}
          />

          {React.createElement('pixiText' as any, {
            ref: countRef,
            style: { ...countFont, fontSize: Math.round(height * 0.7) },
          })}

          {React.createElement('pixiText' as any, {
            ref: descRef,
            style: descriptionFont,
          })}
        </Application>
      )}
    </>
  );
}
