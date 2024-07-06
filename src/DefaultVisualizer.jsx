/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useCallback } from 'react';
import { Stage, Graphics, Text } from '@inlet/react-pixi';
import { Visualizer } from './core';
import {
  divColor,
  nowLineColor,
  subDivColor,
  countFont,
  correctNoteColor,
  incorrectNoteColor,
} from './App.styles';

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
}) {
  const v = useRef(new Visualizer({ metronome: m }));
  const nowLineRef = useRef();
  const countRef = useRef();
  const gridRef = useRef();
  const descRef = useRef();

  useEffect(() => {
    setTimeout(drawGrid, 0);
    m.opts.onUpdateOptions = () => {
      drawGrid();
    };
  }, [m]);

  useEffect(() => {
    if (m.started) {
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
  }, [m.started]);

  useEffect(() => {
    const handleUserClick = e => {
      if (!m.started) return;
      if (e.type === 'touchstart' && e.target.nodeName !== 'CANVAS') return;
      if (e.type === 'keydown' && e.key !== 'Control') return;
      v.current.userClicks.push(m.now);
      m.clicker?.click();
    };
    window.addEventListener('keydown', handleUserClick);
    window.addEventListener('touchstart', handleUserClick);

    return () => {
      window.removeEventListener('keydown', handleUserClick);
      window.removeEventListener('touchstart', handleUserClick);
    };
  }, []);

  // main method for per-frame updates
  const draw = useCallback(() => {
    if (!m.started) return;

    v.current.update();

    // update now line
    if (showNow) {
      nowLineRef.current.x = v.current.progress * width;
    }

    // update count
    if (showCount) {
      countRef.current.text = v.current.count.join('-');
    } else {
      countRef.current.text = '';
    }

    // show timing info for user clicks
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

    // reloop
    requestAnimationFrame(draw);
  }, [m.started, m.barTime, m.bpm]);

  function drawGrid() {
    if (!showGrid) return;
    const g = gridRef.current;
    g.clear();
    m.gridTimes?.forEach((t, i) => {
      const x = (t / m.barTime) * width;
      const isSubDiv = i % m.subDivs > 0;
      g.lineStyle(1, isSubDiv ? subDivColor : divColor);
      g.moveTo(x, 0);
      g.lineTo(x, height);
    });
  }

  return (
    <>
      {m && (
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

          <Text
            ref={descRef}
            x={width / 2}
            y={height - 20}
            anchor={0.5}
            style={{ fontSize: 18, fill: 'white', fontWeight: 'bold' }}
          />
        </Stage>
      )}
    </>
  );
}
