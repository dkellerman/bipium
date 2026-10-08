/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useCallback, useLayoutEffect, useState } from 'react';
import { Application, extend } from '@pixi/react';
import { Graphics, Text as PixiText } from 'pixi.js';
import { Visualizer } from '@/core/index';
import type { DrumLoopLane, DrumLoopPattern, Metronome } from '@/core/index';
import { isEditableEventTarget } from '@/lib/utils';
import { DrumLoopOverlay } from '@/components/DrumLoopOverlay';
import { crispLine } from '@/lib/crisp-line';

interface DefaultVisualizerProps {
  id?: string;
  metronome: Metronome;
  width?: number;
  height?: number;
  showGrid?: boolean;
  showNow?: boolean;
  showCount?: boolean;
  showClicks?: boolean;
  horizontalLines?: number[];
  drumLoopPattern?: DrumLoopPattern;
  onToggleDrumStep?: (lane: DrumLoopLane, stepIndex: number) => void;
}

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
  horizontalLines = [],
  drumLoopPattern,
  onToggleDrumStep,
}: DefaultVisualizerProps) {
  const mAny = m as any;
  const v = useRef(new Visualizer({ metronome: mAny }));
  const frameRef = useRef<number | null>(null);
  const appRef = useRef<any>(null);
  const gridRef = useRef<any>(null);
  const nowLineRef = useRef<any>(null);
  const countRef = useRef<any>(null);
  const descRef = useRef<any>(null);
  const renderStateRef = useRef({
    showNow,
    showCount,
    showClicks,
    width,
    height,
  });
  const beats = m.opts.beats;
  const subDivs = m.opts.subDivs;
  const swing = m.opts.swing;
  const barTime = m.barTime;
  const gridTimes = React.useMemo(() => m.gridTimes, [m, beats, subDivs, swing, barTime]);
  const gridSignature = `${beats}:${subDivs}:${swing}:${width}:${height}`;

  renderStateRef.current = {
    showNow,
    showCount,
    showClicks,
    width,
    height,
  };

  const centerTextAt = (textNode: any, centerX: number, centerY: number) => {
    if (!textNode?.getLocalBounds) return;
    const bounds = textNode.getLocalBounds();
    textNode.x = Math.round(centerX - (bounds.x + bounds.width / 2));
    textNode.y = Math.round(centerY - (bounds.y + bounds.height / 2));
  };

  // The Application mounts once and never remounts (remounting mid-playback
  // kills the renderer on mobile), so size changes are applied to the live
  // renderer here instead. Init is async, so the current size is also applied
  // in onInit — without it the first measured size lands before the renderer
  // exists and is lost.
  const [drawVersion, setDrawVersion] = useState(0);
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };

  const applySize = useCallback((application?: any) => {
    const holder = application ?? (appRef.current as any);
    const app = holder?.getApplication?.() ?? holder;
    app?.renderer?.resize?.(sizeRef.current.width, sizeRef.current.height);
  }, []);

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
      if (!nowLineRef.current || !countRef.current || !descRef.current) {
        frameRef.current = window.requestAnimationFrame(drawFrame);
        return;
      }

      v.current.update();

      const {
        showNow: shouldShowNow,
        showCount: shouldShowCount,
        showClicks: shouldShowClicks,
        width: currentWidth,
        height: currentHeight,
      } = renderStateRef.current;

      nowLineRef.current.visible = shouldShowNow;
      nowLineRef.current.x = Math.max(
        1,
        Math.min(currentWidth - 2, Math.round(v.current.progress * currentWidth)),
      );

      countRef.current.text = shouldShowCount ? v.current.count.join('-') : '';
      centerTextAt(countRef.current, currentWidth / 2, currentHeight / 2 - 10);

      if (!shouldShowClicks) {
        descRef.current.text = '';
      } else if (v.current.qType) {
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
      } else {
        descRef.current.text = DEFAULT_DESC_TEXT;
        descRef.current.style.fill = descriptionFont.fill;
      }
      centerTextAt(descRef.current, currentWidth / 2, currentHeight - 20);

      frameRef.current = window.requestAnimationFrame(drawFrame);
    },
    [mAny.started],
  );

  useEffect(() => {
    cancelDraw();
    if (mAny.started) {
      if (nowLineRef.current) {
        nowLineRef.current.x = 0;
      }
      if (descRef.current) {
        descRef.current.text = showClicks ? DEFAULT_DESC_TEXT : '';
      }
      v.current.start();
      frameRef.current = window.requestAnimationFrame(draw);
    } else {
      if (nowLineRef.current) {
        nowLineRef.current.x = 0;
      }
      if (descRef.current) {
        descRef.current.text = '';
      }
      if (countRef.current) {
        countRef.current.text = '';
      }
      v.current.stop();
    }
  }, [cancelDraw, draw, mAny.started, gridSignature]);

  useEffect(() => cancelDraw, [cancelDraw]);

  const drawGrid = useCallback(
    (g: any) => {
      if (!g) return;
      g.clear();
      if (!showGrid) return;
      if (!barTime) return;
      gridTimes.forEach((t: number, i: number) => {
        const x = (t / barTime) * width;
        const isSubDiv = i % subDivs > 0;
        const px = crispLine(x, width);
        g.setStrokeStyle({ width: 1, color: isSubDiv ? subDivColor : divColor });
        g.moveTo(px, 0);
        g.lineTo(px, height);
        g.stroke();
      });
    },
    // drawVersion: rerun once the Application is ready (see onInit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showGrid, width, height, barTime, subDivs, gridTimes, drawVersion],
  );

  const drawNow = useCallback(
    (g: any) => {
      if (!g) return;
      g.clear();
      if (!showNow) return;
      g.setStrokeStyle({ width: 2, color: nowLineColor, alpha: 1 });
      g.moveTo(0, 0);
      g.lineTo(0, height);
      g.stroke();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [height, showNow, drawVersion],
  );

  // Resizing Pixi's canvas does not reliably rerun Graphics.draw on iOS. The
  // Application also initializes asynchronously, so a size measured before its
  // Graphics exist would be skipped and the lines left at the old height: redraw
  // on every size/grid change, when each Graphics mounts, and when the
  // Application is ready.
  const redraw = useCallback(() => {
    applySize();
    drawGrid(gridRef.current);
    drawNow(nowLineRef.current);
  }, [applySize, drawGrid, drawNow]);
  useLayoutEffect(redraw, [redraw]);
  // Graphics drawn before the Application finished initializing keep that first
  // size; bumping this once it's ready makes Pixi rerun the draws at the current size.
  const onInit = useCallback(
    (application: any) => {
      applySize(application);
      setDrawVersion(v => v + 1);
    },
    [applySize],
  );

  return (
    <>
      {mAny && (
        <Application
          ref={appRef}
          onInit={onInit}
          width={width}
          height={height}
          antialias={false}
          autoDensity
          resolution={1}
          roundPixels
          backgroundAlpha={0}
        >
          <pixiGraphics ref={gridRef} draw={drawGrid} />

          {drumLoopPattern ? (
            <DrumLoopOverlay
              metronome={m}
              width={width}
              height={height}
              pattern={drumLoopPattern}
              horizontalLines={horizontalLines}
              onToggleStep={onToggleDrumStep}
            />
          ) : null}

          <pixiGraphics ref={nowLineRef} draw={drawNow} />

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
