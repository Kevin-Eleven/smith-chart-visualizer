import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Complex, canvasToGamma, gammaToCanvas } from '@/smith/math';
import { renderSmithChart } from '@/smith/renderer';
import type { SmithState } from '@/smith/state';
import { getPointInfo, genId, nextPointColor } from '@/smith/state';

interface Props {
  state: SmithState;
  isDark: boolean;
  onClickChart: (gamma: Complex) => void;
  onSelectPoint: (id: string | null) => void;
  onHoverUpdate: (info: ReturnType<typeof getPointInfo> | null) => void;
}

export default function SmithCanvas({ state, isDark, onClickChart, onSelectPoint, onHoverUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverGamma, setHoverGamma] = useState<Complex | null>(null);
  const [zoom, setZoom] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const getChartParams = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const margin = state.display.showOuterScales ? 55 : 15;
    const chartSize = Math.min(w - margin * 2, h - margin * 2);
    const R = (chartSize / 2) * zoom.scale;
    const cx = w / 2 + zoom.offsetX;
    const cy = h / 2 + zoom.offsetY;
    return { cx, cy, R };
  }, [state.display.showOuterScales, zoom]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderSmithChart(canvas, state, isDark, hoverGamma, zoom);
  }, [state, isDark, hoverGamma, zoom]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ro = new ResizeObserver(() => {
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
      renderSmithChart(canvas, state, isDark, hoverGamma, zoom);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [state, isDark, hoverGamma, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setZoom(z => ({ ...z, offsetX: panStart.current.ox + dx, offsetY: panStart.current.oy + dy }));
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const params = getChartParams();
    if (!params) return;

    const gamma = canvasToGamma(x, y, params.cx, params.cy, params.R);
    if (gamma.abs() <= 1.0) {
      setHoverGamma(gamma);
      onHoverUpdate(getPointInfo(gamma, state.Z0));
    } else {
      setHoverGamma(null);
      onHoverUpdate(null);
    }
  }, [getChartParams, state.Z0, onHoverUpdate]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const params = getChartParams();
    if (!params) return;

    const gamma = canvasToGamma(x, y, params.cx, params.cy, params.R);

    // Check if clicking near an existing point
    for (const point of state.points) {
      const pg = new Complex(point.gamma.re, point.gamma.im);
      const pp = gammaToCanvas(pg, params.cx, params.cy, params.R);
      const dist = Math.sqrt((pp.x - x) ** 2 + (pp.y - y) ** 2);
      if (dist < 12) {
        onSelectPoint(point.id);
        return;
      }
    }

    if (gamma.abs() <= 1.0) {
      onClickChart(gamma);
    }
  }, [getChartParams, state.points, onClickChart, onSelectPoint]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => ({
      scale: Math.max(0.5, Math.min(5, z.scale * delta)),
      offsetX: z.offsetX,
      offsetY: z.offsetY,
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, ox: zoom.offsetX, oy: zoom.offsetY };
    }
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleDoubleClick = useCallback(() => {
    setZoom({ scale: 1, offsetX: 0, offsetY: 0 });
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setHoverGamma(null); onHoverUpdate(null); isPanning.current = false; }}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}
