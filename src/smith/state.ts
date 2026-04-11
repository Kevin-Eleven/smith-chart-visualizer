import { Complex, gammaFromZ, zFromGamma, yFromZ, vswr, returnLoss, wtg, wtl, rotateGamma } from './math';

// === MATCHING TYPES ===

export type ComponentType = 'series_L' | 'series_C' | 'shunt_L' | 'shunt_C';

export interface MatchingStep {
  id: string;
  component: ComponentType;
  value: number;           // normalized reactance (X) or susceptance (B)
  startGamma: Complex;     // gamma before this step
  endGamma: Complex;       // gamma after this step
  arcPoints: Complex[];    // intermediate points for arc drawing
  circleParam: number;     // r for series, g for shunt — the constant circle value
  pointId: string;         // id of the point created by this step
}

// === STATE MANAGEMENT ===

export interface SmithPoint {
  id: string;
  label: string;
  gamma: Complex;
  color: string;
}

export interface DisplaySettings {
  showResistanceCircles: boolean;
  showReactanceArcs: boolean;
  showConductanceCircles: boolean;
  showSusceptanceArcs: boolean;
  showVswrCircle: boolean;
  showRCircle: boolean;
  showXArc: boolean;
  showOuterScales: boolean;
  showQCircles: boolean;
  showPath: boolean;
  gridSnap: boolean;
  qValues: number[];
}

export type ChartMode = 'Z' | 'Y' | 'ZY';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface LogEntry {
  id: string;
  index: number;
  text: string;
  stateSnapshotIndex: number;
}

export interface SmithState {
  points: SmithPoint[];
  activePointId: string | null;
  chartMode: ChartMode;
  Z0: number;
  frequency: number | null;
  frequencyUnit: 'MHz' | 'GHz';
  display: DisplaySettings;
  log: LogEntry[];
  matchingSteps: MatchingStep[];
}

const POINT_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

let colorIndex = 0;

export function nextPointColor(): string {
  const c = POINT_COLORS[colorIndex % POINT_COLORS.length];
  colorIndex++;
  return c;
}

export function resetColorIndex(): void {
  colorIndex = 0;
}

export function createDefaultState(): SmithState {
  return {
    points: [],
    activePointId: null,
    chartMode: 'Z',
    Z0: 1,
    frequency: null,
    frequencyUnit: 'GHz',
    display: {
      showResistanceCircles: true,
      showReactanceArcs: true,
      showConductanceCircles: true,
      showSusceptanceArcs: true,
      showVswrCircle: true,
      showRCircle: true,
      showXArc: true,
      showOuterScales: true,
      showQCircles: false,
      showPath: true,
      gridSnap: false,
      qValues: [1, 2, 5],
    },
    log: [],
    matchingSteps: [],
  };
}

let idCounter = 0;
export function genId(): string {
  return `p${Date.now()}_${idCounter++}`;
}

export function getPointInfo(gamma: Complex, Z0: number) {
  const zn = zFromGamma(gamma);
  const yn = yFromZ(zn);
  const z = new Complex(zn.re * Z0, zn.im * Z0);
  const y = new Complex(yn.re / Z0, yn.im / Z0);
  return {
    gamma,
    gammaMag: gamma.abs(),
    gammaAngle: gamma.argDeg(),
    zNorm: zn,
    yNorm: yn,
    z,
    y,
    vswr: vswr(gamma),
    returnLoss: returnLoss(gamma),
    wtg: wtg(gamma),
    wtl: wtl(gamma),
  };
}

// === LOCALSTORAGE PERSISTENCE ===
export function saveStateToStorage(state: SmithState): void {
  try {
    localStorage.setItem('smithChart_state', JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state to localStorage:', e);
  }
}

function reviveComplex(c: { re: number; im: number }): Complex {
  return new Complex(c.re, c.im);
}

function reviveMatchingSteps(steps: MatchingStep[] | undefined): MatchingStep[] {
  if (!steps) return [];
  return steps.map(s => ({
    ...s,
    startGamma: reviveComplex(s.startGamma),
    endGamma: reviveComplex(s.endGamma),
    arcPoints: s.arcPoints.map(reviveComplex),
  }));
}

export function loadStateFromStorage(): SmithState | null {
  try {
    const saved = localStorage.getItem('smithChart_state');
    if (!saved) return null;
    const parsed = JSON.parse(saved) as SmithState;
    // Revive Complex objects
    parsed.points = parsed.points.map(p => ({
      ...p,
      gamma: reviveComplex(p.gamma),
    }));
    parsed.matchingSteps = reviveMatchingSteps(parsed.matchingSteps);
    return parsed;
  } catch (e) {
    console.warn('Failed to load state from localStorage:', e);
    return null;
  }
}

export function saveThemeToStorage(isDark: boolean): void {
  try {
    localStorage.setItem('smithChart_theme', isDark ? 'dark' : 'light');
  } catch (e) {
    console.warn('Failed to save theme to localStorage:', e);
  }
}

export function loadThemeFromStorage(): boolean | null {
  try {
    const saved = localStorage.getItem('smithChart_theme');
    if (!saved) return null;
    return saved === 'dark';
  } catch (e) {
    console.warn('Failed to load theme from localStorage:', e);
    return null;
  }
}

// History for undo/redo
export class StateHistory {
  private stack: SmithState[] = [];
  private pointer = -1;

  push(state: SmithState) {
    // Remove anything after pointer
    this.stack = this.stack.slice(0, this.pointer + 1);
    // Deep clone
    this.stack.push(JSON.parse(JSON.stringify(state)));
    this.pointer = this.stack.length - 1;
  }

  undo(): SmithState | null {
    if (this.pointer <= 0) return null;
    this.pointer--;
    return this.revive(this.stack[this.pointer]);
  }

  redo(): SmithState | null {
    if (this.pointer >= this.stack.length - 1) return null;
    this.pointer++;
    return this.revive(this.stack[this.pointer]);
  }

  canUndo(): boolean {
    return this.pointer > 0;
  }

  canRedo(): boolean {
    return this.pointer < this.stack.length - 1;
  }

  goToStep(index: number): SmithState | null {
    if (index < 0 || index >= this.stack.length) return null;
    this.pointer = index;
    return this.revive(this.stack[this.pointer]);
  }

  currentIndex(): number {
    return this.pointer;
  }

  clear(): void {
    this.stack = [];
    this.pointer = -1;
  }

  private revive(state: SmithState): SmithState {
    // Reconstruct Complex instances from plain objects
    const s = JSON.parse(JSON.stringify(state)) as SmithState;
    s.points = s.points.map(p => ({
      ...p,
      gamma: new Complex(p.gamma.re, p.gamma.im),
    }));
    s.matchingSteps = reviveMatchingSteps(s.matchingSteps);
    return s;
  }
}
