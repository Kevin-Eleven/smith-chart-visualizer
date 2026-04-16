import {
  Complex,
  resistanceCircle,
  reactanceArc,
  gammaToCanvas,
  qCircle,
} from "./math";
import type { SmithState, SmithPoint, MatchingStep } from "./state";

// === CHART RENDERER ===

const R_VALUES = [0, 0.2, 0.5, 1, 2, 5, 10];
const X_VALUES = [0.2, 0.5, 1, 2, 5];

interface RenderContext {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  R: number;
  dpr: number;
  state: SmithState;
  isDark: boolean;
}

function getColor(
  isDark: boolean,
  lightColor: string,
  darkColor: string,
): string {
  return isDark ? darkColor : lightColor;
}

export function renderSmithChart(
  canvas: HTMLCanvasElement,
  state: SmithState,
  isDark: boolean,
  hoverGamma: Complex | null = null,
  zoomTransform: { scale: number; offsetX: number; offsetY: number } = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
) {
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Clear
  const chartBg = getComputedStyle(document.documentElement)
    .getPropertyValue("--chart-bg")
    .trim();
  ctx.fillStyle = isDark ? "#0f1318" : `hsl(${chartBg || "60 42% 94%"})`;
  ctx.fillRect(0, 0, w, h);

  const margin = state.display.showOuterScales ? 55 : 15;
  const chartSize = Math.min(w - margin * 2, h - margin * 2);
  const R = (chartSize / 2) * zoomTransform.scale;
  const cx = w / 2 + zoomTransform.offsetX;
  const cy = h / 2 + zoomTransform.offsetY;

  const rc: RenderContext = { ctx, cx, cy, R, dpr, state, isDark };

  // Clip to canvas
  ctx.save();

  // Draw outer scales
  if (state.display.showOuterScales && zoomTransform.scale <= 1.5) {
    drawOuterScales(rc);
  }

  // Draw chart grid
  if (state.chartMode === "Z" || state.chartMode === "ZY") {
    drawImpedanceGrid(rc, state.chartMode === "ZY" ? 0.5 : 1.0);
  }
  if (state.chartMode === "Y" || state.chartMode === "ZY") {
    drawAdmittanceGrid(rc, state.chartMode === "ZY" ? 0.5 : 1.0);
  }

  // Q circles
  if (state.display.showQCircles) {
    drawQCircles(rc);
  }

  // Matching arcs
  if (state.matchingSteps && state.matchingSteps.length > 0) {
    drawMatchingArcs(rc);
  }

  // Active point highlights
  const activeIds = new Set(state.activePointIds);
  for (const point of state.points) {
    if (activeIds.has(point.id)) {
      drawPointHighlights(rc, point);
    }
  }

  // Path
  if (state.display.showPath && state.points.length > 1) {
    drawPath(rc);
  }

  // Points
  drawPoints(rc);

  // Hover crosshair
  if (hoverGamma && hoverGamma.abs() <= 1.0) {
    const hp = gammaToCanvas(hoverGamma, cx, cy, R);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, 4, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? "#ffffff80" : "#00000060";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Crosshair lines
    ctx.beginPath();
    ctx.moveTo(hp.x - 8, hp.y);
    ctx.lineTo(hp.x + 8, hp.y);
    ctx.moveTo(hp.x, hp.y - 8);
    ctx.lineTo(hp.x, hp.y + 8);
    ctx.strokeStyle = isDark ? "#ffffff40" : "#00000030";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  ctx.restore();
}

function drawUnitCircle(rc: RenderContext, alpha: number = 1) {
  const { ctx, cx, cy, R, isDark } = rc;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = isDark
    ? `rgba(200,200,220,${alpha})`
    : `rgba(30,30,50,${alpha})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawImpedanceGrid(rc: RenderContext, alpha: number) {
  const { ctx, cx, cy, R, isDark, state } = rc;

  // Unit circle
  drawUnitCircle(rc, alpha);

  // Real axis
  ctx.beginPath();
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.strokeStyle = isDark
    ? `rgba(59,130,246,${alpha})`
    : `rgba(29,78,216,${alpha})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Resistance circles
  if (state.display.showResistanceCircles) {
    for (const r of R_VALUES) {
      const circ = resistanceCircle(r);
      ctx.beginPath();
      ctx.arc(
        cx + circ.cx * R,
        cy - circ.cy * R,
        circ.radius * R,
        0,
        Math.PI * 2,
      );

      ctx.strokeStyle = isDark
        ? `rgba(59,130,246,${alpha * 0.6})`
        : `rgba(37,99,235,${alpha * 0.6})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Label
      if (r > 0) {
        const labelX = cx + (circ.cx - circ.radius) * R;
        // Only label if inside chart
        if (labelX >= cx - R - 5) {
          ctx.fillStyle = isDark ? `#5698fb` : `#0026ff`;
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = "center";
          ctx.fillText(r.toString(), labelX - 3, cy + 12);
        }
      }
    }
  }

  // Reactance arcs
  if (state.display.showReactanceArcs) {
    for (const x of X_VALUES) {
      for (const sign of [1, -1]) {
        const xv = x * sign;
        const arc = reactanceArc(xv);
        drawReactanceArcClipped(rc, arc, alpha, false, xv);
      }
    }
  }
}

function drawAdmittanceGrid(rc: RenderContext, alpha: number) {
  const { ctx, cx, cy, R, isDark, state } = rc;

  if (alpha < 1) {
    // Draw unit circle for admittance (same circle)
  } else {
    drawUnitCircle(rc, alpha);
    // Real axis
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.strokeStyle = isDark
      ? `rgba(13,148,136,${alpha})`
      : `rgba(13,148,136,${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Conductance circles (mirrored resistance circles)
  if (state.display.showConductanceCircles) {
    for (const g of R_VALUES) {
      const circ = resistanceCircle(g);
      // Admittance chart is rotated 180°, so center is mirrored: (-cx, 0)
      ctx.beginPath();
      ctx.arc(cx - circ.cx * R, cy, circ.radius * R, 0, Math.PI * 2);

      ctx.strokeStyle = isDark
        ? `rgba(20,184,166,${alpha * 0.6})`
        : `rgba(13,148,136,${alpha * 0.6})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Label
      if (g > 0) {
        const labelX = cx - circ.cx * R + circ.radius * R;
        // Only label if inside chart
        if (labelX <= cx + R + 5) {
          ctx.fillStyle = isDark
            ? `rgba(45,212,191,${alpha * 0.8})`
            : `rgba(0,100,80,${alpha * 0.8})`;
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = "center";
          ctx.fillText(g.toString(), labelX + 3, cy - 12);
        }
      }
    }
  }

  // Susceptance arcs (mirrored reactance arcs)
  if (state.display.showSusceptanceArcs) {
    for (const b of X_VALUES) {
      for (const sign of [1, -1]) {
        const bv = b * sign;
        const arc = reactanceArc(bv);
        // Mirror: center at (-1, -1/b) for admittance
        const mirroredArc = { cx: -arc.cx, cy: -arc.cy, radius: arc.radius };
        drawReactanceArcClipped(rc, mirroredArc, alpha, true, bv);
      }
    }
  }
}

function drawReactanceArcClipped(
  rc: RenderContext,
  arc: { cx: number; cy: number; radius: number },
  alpha: number,
  isAdmittance: boolean,
  reactanceValue: number = 0,
) {
  const { ctx, cx, cy, R, isDark } = rc;

  if (!isFinite(arc.radius)) return;

  // The arc circle is at (arc.cx, arc.cy) with arc.radius in normalized coords
  // We need to find the portion inside the unit circle
  const arcCx = cx + arc.cx * R;
  const arcCy = cy - arc.cy * R;
  const arcR = arc.radius * R;

  // Find intersection of arc circle with unit circle
  // Unit circle center: (cx, cy), radius R
  const dx = arcCx - cx;
  const dy = arcCy - cy;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d > R + arcR || d < Math.abs(R - arcR)) return; // No intersection

  // Angle of arc center relative to unit circle center
  const angleToArcCenter = Math.atan2(-(arcCy - cy), arcCx - cx);

  // Use cos rule to find half-angle subtended at arc center by intersection chord
  const cosAngle = (arcR * arcR + d * d - R * R) / (2 * arcR * d);
  const halfAngle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

  // Angle from arc center to unit circle center
  const angleFromArc = Math.atan2(cy - arcCy, cx - arcCx);

  const startAngle = angleFromArc - halfAngle;
  const endAngle = angleFromArc + halfAngle;

  ctx.beginPath();
  ctx.arc(arcCx, arcCy, arcR, startAngle, endAngle);

  if (isAdmittance) {
    ctx.strokeStyle = isDark
      ? `rgba(124,58,237,${alpha * 0.6})`
      : `rgba(15,55,160,${alpha * 0.6})`;
  } else {
    ctx.strokeStyle = isDark
      ? `rgba(251,191,36,${alpha * 0.6})`
      : `rgba(217,119,6,${alpha * 0.6})`;
  }
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Draw text label at the end of the arc
  if (!isAdmittance && reactanceValue !== 0) {
    // For positive reactance, use endAngle. For negative, use startAngle.
    const textAngle = reactanceValue > 0 ? endAngle : startAngle;
    const textX = arcCx + arcR * Math.cos(textAngle);
    const textY = arcCy + arcR * Math.sin(textAngle);

    ctx.fillStyle = isDark ? `rgba(251,191,36)` : `rgba(180, 83, 9, 1)`;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const valueText = reactanceValue.toFixed(1);
    ctx.fillText(valueText, textX + 15, textY);
  }

  // Draw text label for admittance arcs
  if (isAdmittance && reactanceValue !== 0) {
    // For positive susceptance, use endAngle. For negative, use startAngle.
    const textAngle = reactanceValue > 0 ? endAngle : startAngle;
    const textX = arcCx + arcR * Math.cos(textAngle);
    const textY = arcCy + arcR * Math.sin(textAngle);

    ctx.fillStyle = isDark ? `rgb(157, 112, 235)` : `rgb(75, 15, 160)`;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const valueText = reactanceValue.toFixed(1);
    ctx.fillText(valueText, textX - 15, textY);
  }
}

function drawQCircles(rc: RenderContext) {
  const { ctx, cx, cy, R, isDark, state } = rc;

  for (const Q of state.display.qValues) {
    const qc = qCircle(Q);

    // Upper Q circle
    drawQCircleHalf(rc, qc, 1);
    // Lower Q circle
    drawQCircleHalf(rc, { cx: qc.cx, cy: -qc.cy, radius: qc.radius }, -1);
  }
}

function drawQCircleHalf(
  rc: RenderContext,
  qc: { cx: number; cy: number; radius: number },
  _sign: number,
) {
  const { ctx, cx, cy, R, isDark } = rc;
  const qcx = cx + qc.cx * R;
  const qcy = cy - qc.cy * R;
  const qr = qc.radius * R;

  // Clip to unit circle
  const d = Math.sqrt((qcx - cx) ** 2 + (qcy - cy) ** 2);
  if (d > R + qr || d < Math.abs(R - qr)) return;

  const cosA = (qr * qr + d * d - R * R) / (2 * qr * d);
  const halfAngle = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const angleFromQ = Math.atan2(cy - qcy, cx - qcx);

  ctx.beginPath();
  ctx.arc(qcx, qcy, qr, angleFromQ - halfAngle, angleFromQ + halfAngle);
  ctx.strokeStyle = isDark ? "#f472b690" : "#ec489980";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPointHighlights(rc: RenderContext, point: SmithPoint) {
  const { ctx, cx, cy, R, isDark, state } = rc;
  const gamma = new Complex(point.gamma.re, point.gamma.im);
  const mag = gamma.abs();
  const highlightSettings = point.highlightSettings ?? {
    showVswrCircle: state.display.showVswrCircle,
    showRCircle: state.display.showRCircle,
    showXArc: state.display.showXArc,
  };

  // VSWR circle
  if (highlightSettings.showVswrCircle) {
    ctx.beginPath();
    ctx.arc(cx, cy, mag * R, 0, Math.PI * 2);
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // r-circle highlight
  if (highlightSettings.showRCircle) {
    const zn = new Complex(1).add(gamma).div(new Complex(1).sub(gamma));
    const r = zn.re;
    if (r >= 0 && isFinite(r)) {
      const circ = { cx: r / (r + 1), cy: 0, radius: 1 / (r + 1) };
      ctx.beginPath();
      ctx.arc(cx + circ.cx * R, cy, circ.radius * R, 0, Math.PI * 2);
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // x-arc highlight
  if (highlightSettings.showXArc) {
    const zn = new Complex(1).add(gamma).div(new Complex(1).sub(gamma));
    const x = zn.im;
    if (Math.abs(x) > 0.01 && isFinite(x)) {
      const arc = { cx: 1, cy: 1 / x, radius: 1 / Math.abs(x) };
      const arcCx = cx + arc.cx * R;
      const arcCy = cy - arc.cy * R;
      const arcR = arc.radius * R;

      const d = Math.sqrt((arcCx - cx) ** 2 + (arcCy - cy) ** 2);
      if (d <= R + arcR && d >= Math.abs(R - arcR)) {
        const cosA = (arcR * arcR + d * d - R * R) / (2 * arcR * d);
        const halfAngle = Math.acos(Math.max(-1, Math.min(1, cosA)));
        const angleFromArc = Math.atan2(cy - arcCy, cx - arcCx);

        ctx.beginPath();
        ctx.arc(
          arcCx,
          arcCy,
          arcR,
          angleFromArc - halfAngle,
          angleFromArc + halfAngle,
        );
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
}

function drawPath(rc: RenderContext) {
  const { ctx, cx, cy, R, state } = rc;
  if (state.points.length < 2) return;

  ctx.beginPath();
  const p0 = gammaToCanvas(
    new Complex(state.points[0].gamma.re, state.points[0].gamma.im),
    cx,
    cy,
    R,
  );
  ctx.moveTo(p0.x, p0.y);

  for (let i = 1; i < state.points.length; i++) {
    const pi = gammaToCanvas(
      new Complex(state.points[i].gamma.re, state.points[i].gamma.im),
      cx,
      cy,
      R,
    );
    ctx.lineTo(pi.x, pi.y);
  }

  ctx.strokeStyle = "#6366f180";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPoints(rc: RenderContext) {
  const { ctx, cx, cy, R, state, isDark } = rc;

  for (const point of state.points) {
    const gamma = new Complex(point.gamma.re, point.gamma.im);
    const pos = gammaToCanvas(gamma, cx, cy, R);
    const isActive = point.id === state.activePointId;

    if (isActive) {
      // Outer ring
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = point.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Filled dot
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, isActive ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = point.color;
    ctx.fill();

    // Label
    ctx.fillStyle = isDark ? "#e2e8f0" : "#1e293b";
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = "left";
    ctx.fillText(point.label, pos.x + (isActive ? 14 : 8), pos.y - 4);
  }
}

function drawMatchingArcs(rc: RenderContext) {
  const { ctx, cx, cy, R, isDark, state } = rc;

  const ARC_COLORS: Record<string, string> = {
    series_L: "#16a34a",
    series_C: "#2563eb",
    shunt_L: "#d97706",
    shunt_C: "#8b5cf6",
  };

  const COMPONENT_LABELS: Record<string, string> = {
    series_L: "L",
    series_C: "C",
    shunt_L: "L",
    shunt_C: "C",
  };

  for (const step of state.matchingSteps) {
    if (step.arcPoints.length < 2) continue;

    const color = ARC_COLORS[step.component] || "#888";

    // Draw the arc path
    ctx.beginPath();
    const p0 = gammaToCanvas(
      new Complex(step.arcPoints[0].re, step.arcPoints[0].im),
      cx,
      cy,
      R,
    );
    ctx.moveTo(p0.x, p0.y);

    for (let i = 1; i < step.arcPoints.length; i++) {
      const pi = gammaToCanvas(
        new Complex(step.arcPoints[i].re, step.arcPoints[i].im),
        cx,
        cy,
        R,
      );
      ctx.lineTo(pi.x, pi.y);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw arrowhead at the end of the arc
    const len = step.arcPoints.length;
    if (len >= 2) {
      const pEnd = gammaToCanvas(
        new Complex(step.arcPoints[len - 1].re, step.arcPoints[len - 1].im),
        cx,
        cy,
        R,
      );
      const pPrev = gammaToCanvas(
        new Complex(step.arcPoints[len - 2].re, step.arcPoints[len - 2].im),
        cx,
        cy,
        R,
      );

      const angle = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
      const arrowLen = 8;
      const arrowWidth = Math.PI / 6;

      ctx.beginPath();
      ctx.moveTo(pEnd.x, pEnd.y);
      ctx.lineTo(
        pEnd.x - arrowLen * Math.cos(angle - arrowWidth),
        pEnd.y - arrowLen * Math.sin(angle - arrowWidth),
      );
      ctx.moveTo(pEnd.x, pEnd.y);
      ctx.lineTo(
        pEnd.x - arrowLen * Math.cos(angle + arrowWidth),
        pEnd.y - arrowLen * Math.sin(angle + arrowWidth),
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label at midpoint of arc
    const midIdx = Math.floor(step.arcPoints.length / 2);
    const pMid = gammaToCanvas(
      new Complex(step.arcPoints[midIdx].re, step.arcPoints[midIdx].im),
      cx,
      cy,
      R,
    );

    const isShunt =
      step.component === "shunt_L" || step.component === "shunt_C";
    const deltaSymbol = isShunt ? "ΔB" : "ΔX";
    const labelText = `${COMPONENT_LABELS[step.component]} ${deltaSymbol}=${step.value >= 0 ? "+" : ""}${step.value.toFixed(2)}`;

    ctx.fillStyle = color;
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Offset label away from center
    const dx = pMid.x - cx;
    const dy = pMid.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offsetDist = 14;
    const lx = pMid.x + (dx / (dist || 1)) * offsetDist;
    const ly = pMid.y + (dy / (dist || 1)) * offsetDist;

    // Background for readability
    const metrics = ctx.measureText(labelText);
    const pad = 2;
    ctx.fillStyle = isDark ? "rgba(15,19,24,0.85)" : "rgba(255,255,255,0.85)";
    ctx.fillRect(
      lx - metrics.width / 2 - pad,
      ly - 6 - pad,
      metrics.width + pad * 2,
      12 + pad * 2,
    );

    ctx.fillStyle = color;
    ctx.fillText(labelText, lx, ly);
  }
}

function drawOuterScales(rc: RenderContext) {
  const { ctx, cx, cy, R, isDark } = rc;
  const outerR1 = R + 12;
  const outerR2 = R + 26;
  const outerR3 = R + 40;

  // WTG ring
  ctx.strokeStyle = isDark ? "#3b82f680" : "#2563eb80";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR1, 0, Math.PI * 2);
  ctx.stroke();

  // WTL ring
  ctx.strokeStyle = isDark ? "#22c55e80" : "#16a34a80";
  ctx.beginPath();
  ctx.arc(cx, cy, outerR2, 0, Math.PI * 2);
  ctx.stroke();

  // Angle ring
  ctx.strokeStyle = isDark ? "#94a3b880" : "#64748b80";
  ctx.beginPath();
  ctx.arc(cx, cy, outerR3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = '10px "JetBrains Mono", monospace';

  // WTG ticks (clockwise, 0 at right/top going clockwise)
  // WTG goes 0 to 0.5λ over 360°
  for (let i = 0; i <= 50; i++) {
    const wtgVal = i * 0.01;
    // Angle: WTG=0 at rightmost point of real axis on upper side
    // going clockwise, so angle = -(wtgVal * 720°) in standard math coords
    // Actually: 0λ starts at angle 180° (left side, short circuit end) on the chart
    // and goes clockwise. Let's use standard: angle = π - wtgVal * 4π
    const angle = Math.PI - wtgVal * 4 * Math.PI;
    const tickLen = i % 5 === 0 ? 6 : 3;

    const x1 = cx + outerR1 * Math.cos(angle);
    const y1 = cy - outerR1 * Math.sin(angle);
    const x2 = cx + (outerR1 + tickLen) * Math.cos(angle);
    const y2 = cy - (outerR1 + tickLen) * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = isDark ? "#3b82f660" : "#2563eb60";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (i % 5 === 0) {
      const lx = cx + (outerR1 + 10) * Math.cos(angle);
      let ly = cy - (outerR1 + 10) * Math.sin(angle);
      // Offset 0.50 label below 0.00
      if (Math.abs(wtgVal - 0.0) < 0.001) ly -= 6;
      if (Math.abs(wtgVal - 0.5) < 0.001) ly += 6;
      ctx.fillStyle = isDark ? "#5698fb" : "#0026ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(wtgVal.toFixed(2), lx, ly);
    }
  }

  // Angle ring labels
  for (let deg = -180; deg < 180; deg += 30) {
    const angle = (deg * Math.PI) / 180;
    const x1 = cx + outerR3 * Math.cos(angle);
    const y1 = cy - outerR3 * Math.sin(angle);
    const tickLen = 4;
    const x2 = cx + (outerR3 + tickLen) * Math.cos(angle);
    const y2 = cy - (outerR3 + tickLen) * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = isDark ? "#94a3b860" : "#64748b60";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const lx = cx + (outerR3 + 12) * Math.cos(angle);
    const ly = cy - (outerR3 + 12) * Math.sin(angle);
    ctx.fillStyle = isDark ? "#e7eaef" : "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(deg === -180 ? "±180°" : `${deg}°`, lx, ly);
  }
}
