// === COMPLEX MATH ===
export class Complex {
  re: number;
  im: number;

  constructor(re: number, im: number = 0) {
    this.re = re;
    this.im = im;
  }

  static fromPolar(mag: number, angleDeg: number): Complex {
    const rad = (angleDeg * Math.PI) / 180;
    return new Complex(mag * Math.cos(rad), mag * Math.sin(rad));
  }

  static fromPolarRad(mag: number, angleRad: number): Complex {
    return new Complex(mag * Math.cos(angleRad), mag * Math.sin(angleRad));
  }

  add(other: Complex): Complex {
    return new Complex(this.re + other.re, this.im + other.im);
  }

  sub(other: Complex): Complex {
    return new Complex(this.re - other.re, this.im - other.im);
  }

  mul(other: Complex): Complex {
    return new Complex(
      this.re * other.re - this.im * other.im,
      this.re * other.im + this.im * other.re
    );
  }

  div(other: Complex): Complex {
    const denom = other.re * other.re + other.im * other.im;
    if (denom === 0) return new Complex(Infinity, Infinity);
    return new Complex(
      (this.re * other.re + this.im * other.im) / denom,
      (this.im * other.re - this.re * other.im) / denom
    );
  }

  abs(): number {
    return Math.sqrt(this.re * this.re + this.im * this.im);
  }

  arg(): number {
    return Math.atan2(this.im, this.re);
  }

  argDeg(): number {
    return (this.arg() * 180) / Math.PI;
  }

  conj(): Complex {
    return new Complex(this.re, -this.im);
  }

  neg(): Complex {
    return new Complex(-this.re, -this.im);
  }

  scale(s: number): Complex {
    return new Complex(this.re * s, this.im * s);
  }

  static exp(c: Complex): Complex {
    const r = Math.exp(c.re);
    return new Complex(r * Math.cos(c.im), r * Math.sin(c.im));
  }

  toString(decimals = 4): string {
    const r = this.re.toFixed(decimals);
    const i = Math.abs(this.im).toFixed(decimals);
    const sign = this.im >= 0 ? '+' : '-';
    return `${r} ${sign} j${i}`;
  }
}

// === SMITH CHART GEOMETRY ===

/** Impedance to reflection coefficient (normalized) */
export function gammaFromZ(zn: Complex): Complex {
  return zn.sub(new Complex(1)).div(zn.add(new Complex(1)));
}

/** Reflection coefficient to normalized impedance */
export function zFromGamma(gamma: Complex): Complex {
  return new Complex(1).add(gamma).div(new Complex(1).sub(gamma));
}

/** Normalized impedance to admittance */
export function yFromZ(zn: Complex): Complex {
  if (zn.abs() === 0) return new Complex(Infinity, Infinity);
  return new Complex(1).div(zn);
}

/** Normalized admittance to impedance */
export function zFromY(yn: Complex): Complex {
  if (yn.abs() === 0) return new Complex(Infinity, Infinity);
  return new Complex(1).div(yn);
}

/** Rotate gamma (move d wavelengths toward generator = clockwise) */
export function rotateGamma(gamma: Complex, d: number): Complex {
  const angle = -4 * Math.PI * d;
  return gamma.mul(Complex.fromPolarRad(1, angle));
}

/** VSWR from reflection coefficient */
export function vswr(gamma: Complex): number {
  const mag = gamma.abs();
  if (mag >= 1) return Infinity;
  return (1 + mag) / (1 - mag);
}

/** Return loss in dB */
export function returnLoss(gamma: Complex): number {
  const mag = gamma.abs();
  if (mag === 0) return Infinity;
  return -20 * Math.log10(mag);
}

/** Wavelengths toward generator from gamma angle */
export function wtg(gamma: Complex): number {
  // angle in radians, WTG = (180 - argDeg) / 720 mapped to 0-0.5
  let angle = gamma.argDeg();
  // WTG: start at rightmost point (angle=0) = 0λ, going clockwise
  // Standard: WTG = (180 - angle) / 360, wrapped to 0-0.5
  let w = (180 - angle) / 720;
  if (w < 0) w += 0.5;
  if (w >= 0.5) w -= 0.5;
  return w;
}

/** Wavelengths toward load from gamma angle */
export function wtl(gamma: Complex): number {
  let w = 0.5 - wtg(gamma);
  if (w < 0) w += 0.5;
  if (w >= 0.5) w -= 0.5;
  return w;
}

/** Constant resistance circle: center = (r/(r+1), 0), radius = 1/(r+1) */
export function resistanceCircle(r: number): { cx: number; cy: number; radius: number } {
  return { cx: r / (r + 1), cy: 0, radius: 1 / (r + 1) };
}

/** Constant reactance arc: center = (1, 1/x), radius = 1/|x| */
export function reactanceArc(x: number): { cx: number; cy: number; radius: number } {
  if (x === 0) return { cx: 1, cy: Infinity, radius: Infinity }; // real axis
  return { cx: 1, cy: 1 / x, radius: 1 / Math.abs(x) };
}

/** Stub impedance: short stub of length l wavelengths → Zin = j*tan(2πl) */
export function shortStubImpedance(l: number): Complex {
  return new Complex(0, Math.tan(2 * Math.PI * l));
}

/** Open stub impedance: Zin = -j*cot(2πl) = -j/tan(2πl) */
export function openStubImpedance(l: number): Complex {
  const t = Math.tan(2 * Math.PI * l);
  if (Math.abs(t) < 1e-12) return new Complex(0, -Infinity);
  return new Complex(0, -1 / t);
}

/** Convert S11 in dB to linear magnitude */
export function s11DbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/** Gamma to canvas coordinates */
export function gammaToCanvas(
  gamma: Complex,
  cx: number,
  cy: number,
  R: number
): { x: number; y: number } {
  return {
    x: cx + gamma.re * R,
    y: cy - gamma.im * R,
  };
}

/** Canvas coordinates to gamma */
export function canvasToGamma(
  canvasX: number,
  canvasY: number,
  cx: number,
  cy: number,
  R: number
): Complex {
  return new Complex((canvasX - cx) / R, -(canvasY - cy) / R);
}

// Q circle: the locus of points where Q = |x|/r = const
// On the Smith chart, Q circles pass through origin and have
// center at (0, 1/(2Q)) and (0, -1/(2Q)) with radius 1/(2Q) + correction
// Actually: Q = Im(z)/Re(z), so on the reflection coefficient plane,
// Q circle: center = (0, ±1/Q), radius = sqrt(1 + 1/Q²)... 
// Simpler: in the z-plane, Q = x/r defines a line x = Qr through origin.
// Mapping to Γ-plane via bilinear transform gives a circle.
// Center: (0, 1/Q), radius: sqrt(1 + 1/Q²) is incorrect.
// Correct: Q circle in Γ-plane has center (0, 1/Q) and radius sqrt(1+1/(Q*Q))
// But clipped to unit circle.
// Actually for constant Q: z = r + jQr, so z = r(1+jQ).
// Γ = (z-1)/(z+1) = (r(1+jQ)-1)/(r(1+jQ)+1)
// As r varies from 0 to ∞, this traces a circle in the Γ-plane.
// At r=0: Γ = -1. At r=∞: Γ = 1.
// The circle passes through Γ=-1 and Γ=1 (i.e., through (-1,0) and (1,0)).
// For the upper half (Q>0), center is at (0, 1/Q), radius = sqrt(1 + 1/(Q²)).
// Wait, that doesn't pass through (±1, 0). Let me recalculate.
// The Q-circle center and radius in Γ-plane:
// center = (0, 1/Q), radius = sqrt(1 + 1/Q²)
// Check: distance from center to (1,0) = sqrt(1 + 1/Q²) = radius ✓
// distance from center to (-1,0) = sqrt(1 + 1/Q²) = radius ✓
// Great, so it works.

export function qCircle(Q: number): { cx: number; cy: number; radius: number } {
  return {
    cx: 0,
    cy: 1 / Q,
    radius: Math.sqrt(1 + 1 / (Q * Q)),
  };
}

// === LUMPED-ELEMENT MATCHING ===

/** Constant conductance circle in Γ-plane (mirrored resistance circle) */
export function conductanceCircle(g: number): { cx: number; cy: number; radius: number } {
  return { cx: -g / (g + 1), cy: 0, radius: 1 / (g + 1) };
}

/** Constant susceptance arc in Γ-plane (mirrored reactance arc) */
export function susceptanceArc(b: number): { cx: number; cy: number; radius: number } {
  if (b === 0) return { cx: -1, cy: Infinity, radius: Infinity };
  return { cx: -1, cy: -1 / b, radius: 1 / Math.abs(b) };
}

/**
 * Apply series reactance: adds +j·deltaX to normalized impedance.
 * Stays on constant-resistance circle.
 * Series L → deltaX > 0 (clockwise)
 * Series C → deltaX < 0 (anti-clockwise)
 */
export function applySeriesReactance(gamma: Complex, deltaX: number): Complex {
  const zn = zFromGamma(gamma);
  const zNew = new Complex(zn.re, zn.im + deltaX);
  return gammaFromZ(zNew);
}

/**
 * Apply shunt susceptance: adds +j·deltaB to normalized admittance.
 * Stays on constant-conductance circle.
 * Shunt C → deltaB > 0 (clockwise)
 * Shunt L → deltaB < 0 (anti-clockwise)
 */
export function applyShuntSusceptance(gamma: Complex, deltaB: number): Complex {
  const zn = zFromGamma(gamma);
  const yn = yFromZ(zn);
  const yNew = new Complex(yn.re, yn.im + deltaB);
  const zNew = zFromY(yNew);
  return gammaFromZ(zNew);
}

/**
 * Generate intermediate gamma points along a constant-resistance circle
 * from gammaStart to gammaEnd. Used for rendering matching arcs.
 */
export function arcPointsOnConstantR(
  gammaStart: Complex,
  gammaEnd: Complex,
  numPoints: number = 64
): Complex[] {
  const zStart = zFromGamma(gammaStart);
  const zEnd = zFromGamma(gammaEnd);
  const r = zStart.re; // constant resistance
  const xStart = zStart.im;
  const xEnd = zEnd.im;

  const points: Complex[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = xStart + (xEnd - xStart) * t;
    const z = new Complex(r, x);
    const g = gammaFromZ(z);
    if (g.abs() <= 1.001) {
      points.push(g);
    }
  }
  return points;
}

/**
 * Generate intermediate gamma points along a constant-conductance circle
 * from gammaStart to gammaEnd. Used for rendering matching arcs.
 */
export function arcPointsOnConstantG(
  gammaStart: Complex,
  gammaEnd: Complex,
  numPoints: number = 64
): Complex[] {
  const zStart = zFromGamma(gammaStart);
  const zEnd = zFromGamma(gammaEnd);
  const yStart = yFromZ(zStart);
  const yEnd = yFromZ(zEnd);
  const g = yStart.re; // constant conductance
  const bStart = yStart.im;
  const bEnd = yEnd.im;

  const points: Complex[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const b = bStart + (bEnd - bStart) * t;
    const y = new Complex(g, b);
    const z = zFromY(y);
    const gam = gammaFromZ(z);
    if (gam.abs() <= 1.001) {
      points.push(gam);
    }
  }
  return points;
}
