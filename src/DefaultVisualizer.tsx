/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useCallback } from 'react';
import { Stage, Graphics, Text } from '@inlet/react-pixi';
import { Visualizer } from './core';
import type { DefaultVisualizerProps } from './types';

const divColor = 0xbbbbbb;
const subDivColor = 0x666666;
const nowLineColor = 0x00ff00;
const incorrectNoteColor = 0xff0000;
const correctNoteColor = 0x00ff00;

const countFont = {
  fill: 0xffffff,
  fontFamily: 'sans-serif',
  strokeThickness: 10,
};

const descriptionFont = {
  fill: 0xffffff,
  fontFamily: 'sans-serif',
  fontSize: 18,
  fontWeight: 'bold' as any,
};

const touchEnabled = 'ontouchstart' in window;

const DEFAULT_DESC_TEXT = touchEnabled
  ? 'Tap box on beat to play along'
  : 'Press Ctrl key on beat to tap along';

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

  useEffect(() => {
    setTimeout(drawGrid, 0);
    mAny.opts.onUpdateOptions = () => {
      drawGrid();
    };
  }, [mAny]);

  useEffect(() => {
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

    v.current.update();

    if (showNow) {
      nowLineRef.current.x = v.current.progress * width;
    }

    if (showCount) {
      countRef.current.text = v.current.count.join('-');
    } else {
      countRef.current.text = '';
    }

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
      g.lineStyle(1, isSubDiv ? subDivColor : divColor);
      g.moveTo(x, 0);
      g.lineTo(x, height);
    });
  }

  return (
    <>
      {mAny && (
        <Stage width={width} height={height} options={{ antialias: true }}>
          <Graphics ref={gridRef} />

          <Graphics
            ref={nowLineRef}
            draw={g => {
              g.lineStyle(1, nowLineColor, 1);
              g.moveTo(0, 0);
              g.lineTo(0, height);
            }}
          />

          <Text
            ref={countRef}
            x={width / 2}
            y={height / 2 - 10}
            anchor={0.5}
            style={{ ...countFont, fontSize: Math.round(height * 0.7) }}
          />

          <Text ref={descRef} x={width / 2} y={height - 20} anchor={0.5} style={descriptionFont} />
        </Stage>
      )}
    </>
  );
}
