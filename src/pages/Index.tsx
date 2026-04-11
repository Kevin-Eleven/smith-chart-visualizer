import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Complex, zFromGamma, yFromZ, applySeriesReactance, applyShuntSusceptance, arcPointsOnConstantR, arcPointsOnConstantG } from '@/smith/math';
import {
  createDefaultState,
  genId,
  nextPointColor,
  resetColorIndex,
  getPointInfo,
  StateHistory,
  saveStateToStorage,
  loadStateFromStorage,
  saveThemeToStorage,
  loadThemeFromStorage,
  type SmithState,
  type ChartMode,
  type DisplaySettings,
  type ComponentType,
  type MatchingStep,
} from '@/smith/state';
import SmithCanvas from '@/components/SmithCanvas';
import InputPanel from '@/components/InputPanel';
import PointsPanel from '@/components/PointsPanel';
import SolutionLogPanel from '@/components/SolutionLogPanel';
import SettingsPanel from '@/components/SettingsPanel';
import MatchingPanel from '@/components/MatchingPanel';
import StatusBar from '@/components/StatusBar';

type Tab = 'input' | 'points' | 'log' | 'settings' | 'matching';

const history = new StateHistory();

const Index = () => {
  const [state, setState] = useState<SmithState>(() => {
    const saved = loadStateFromStorage();
    const s = saved || createDefaultState();
    history.push(s);
    return s;
  });
  const [activeTab, setActiveTab] = useState<Tab>('input');
  const [hoverInfo, setHoverInfo] = useState<ReturnType<typeof getPointInfo> | null>(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = loadThemeFromStorage();
    return saved !== null ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Save theme to localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    saveThemeToStorage(isDark);
  }, [isDark]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  const pushState = useCallback((newState: SmithState) => {
    history.push(newState);
    setState(newState);
  }, []);

  const addLogEntry = useCallback((s: SmithState, text: string): SmithState => {
    return {
      ...s,
      log: [...s.log, {
        id: genId(),
        index: s.log.length + 1,
        text,
        stateSnapshotIndex: history.currentIndex() + 1,
      }],
    };
  }, []);

  const handlePlotPoint = useCallback((gamma: Complex, description: string) => {
    const info = getPointInfo(gamma, state.Z0);
    const label = `P${state.points.length + 1}`;
    const color = nextPointColor();
    const newPoint = { id: genId(), label, gamma, color };
    let newState = {
      ...state,
      points: [...state.points, newPoint],
      activePointId: newPoint.id,
    };
    const fullDesc = `${description} → Γ = ${info.gammaMag.toFixed(3)}∠${info.gammaAngle.toFixed(1)}°, VSWR = ${info.vswr.toFixed(2)}`;
    newState = addLogEntry(newState, fullDesc);
    pushState(newState);
  }, [state, pushState, addLogEntry]);

  const handleClickChart = useCallback((gamma: Complex) => {
    const info = getPointInfo(gamma, state.Z0);
    const desc = `Plotted point at Z = ${info.z.re.toFixed(1)} ${info.z.im >= 0 ? '+' : '-'} j${Math.abs(info.z.im).toFixed(1)} Ω`;
    handlePlotPoint(gamma, desc);
  }, [state.Z0, handlePlotPoint]);

  const handleNavigate = useCallback((gamma: Complex, description: string) => {
    const info = getPointInfo(gamma, state.Z0);
    const label = `P${state.points.length + 1}`;
    const color = nextPointColor();
    const newPoint = { id: genId(), label, gamma, color };
    let newState = {
      ...state,
      points: [...state.points, newPoint],
      activePointId: newPoint.id,
    };
    const fullDesc = `${description} → Z = ${info.zNorm.re.toFixed(3)} ${info.zNorm.im >= 0 ? '+' : '-'} j${Math.abs(info.zNorm.im).toFixed(3)} (norm)`;
    newState = addLogEntry(newState, fullDesc);
    pushState(newState);
  }, [state, pushState, addLogEntry]);

  const handleSelectPoint = useCallback((id: string | null) => {
    setState(s => ({ ...s, activePointId: id }));
  }, []);

  const handleDeletePoint = useCallback((id: string) => {
    const newState = {
      ...state,
      points: state.points.filter(p => p.id !== id),
      activePointId: state.activePointId === id ? null : state.activePointId,
    };
    pushState(newState);
  }, [state, pushState]);

  const handleRenamePoint = useCallback((id: string, name: string) => {
    const newState = {
      ...state,
      points: state.points.map(p => p.id === id ? { ...p, label: name } : p),
    };
    pushState(newState);
  }, [state, pushState]);

  const handleChartMode = useCallback((mode: ChartMode) => {
    pushState({ ...state, chartMode: mode });
  }, [state, pushState]);

  const handleUndo = useCallback(() => {
    const s = history.undo();
    if (s) setState(s);
  }, []);

  const handleRedo = useCallback(() => {
    const s = history.redo();
    if (s) setState(s);
  }, []);

  const handleReset = useCallback(() => {
    const ok = window.confirm('Reset chart and clear all points, logs, and history?');
    if (!ok) return;

    const fresh = createDefaultState();
    resetColorIndex();

    history.clear();
    history.push(fresh);

    setState(fresh);
    setActiveTab('input');
    setHoverInfo(null);
    
    // Also clear from localStorage
    localStorage.removeItem('smithChart_state');
  }, []);

  const handleGoToStep = useCallback((index: number) => {
    const s = history.goToStep(index);
    if (s) setState(s);
  }, []);

  const handleClearLog = useCallback(() => {
    pushState({ ...state, log: [] });
  }, [state, pushState]);

  const handleApplyMatchingStep = useCallback((component: ComponentType, magnitude: number) => {
    const activePoint = state.points.find(p => p.id === state.activePointId);
    if (!activePoint) return;

    const gamma = new Complex(activePoint.gamma.re, activePoint.gamma.im);
    const isSeries = component === 'series_L' || component === 'series_C';

    // Compute signed delta
    let signedValue: number;
    switch (component) {
      case 'series_L': signedValue = magnitude; break;
      case 'series_C': signedValue = -magnitude; break;
      case 'shunt_L':  signedValue = -magnitude; break;
      case 'shunt_C':  signedValue = magnitude; break;
    }

    // Apply the transformation
    const newGamma = isSeries
      ? applySeriesReactance(gamma, signedValue)
      : applyShuntSusceptance(gamma, signedValue);

    // Compute arc points for rendering
    const arcPoints = isSeries
      ? arcPointsOnConstantR(gamma, newGamma)
      : arcPointsOnConstantG(gamma, newGamma);

    // Determine circle parameter
    const zn = zFromGamma(gamma);
    const yn = yFromZ(zn);
    const circleParam = isSeries ? zn.re : yn.re;

    // Create new point
    const label = `P${state.points.length + 1}`;
    const color = nextPointColor();
    const newPoint = { id: genId(), label, gamma: newGamma, color };

    // Create matching step
    const step: MatchingStep = {
      id: genId(),
      component,
      value: signedValue,
      startGamma: gamma,
      endGamma: newGamma,
      arcPoints,
      circleParam,
      pointId: newPoint.id,
    };

    const componentLabels: Record<ComponentType, string> = {
      series_L: 'Series Inductor',
      series_C: 'Series Capacitor',
      shunt_L: 'Shunt Inductor',
      shunt_C: 'Shunt Capacitor',
    };

    const info = getPointInfo(newGamma, state.Z0);
    const deltaLabel = isSeries ? 'ΔX' : 'ΔB';
    const desc = `${componentLabels[component]} (${deltaLabel} = ${signedValue >= 0 ? '+' : ''}${signedValue.toFixed(3)}) → Z = ${info.zNorm.toString(3)} (norm), VSWR = ${info.vswr.toFixed(2)}`;

    let newState: SmithState = {
      ...state,
      points: [...state.points, newPoint],
      activePointId: newPoint.id,
      matchingSteps: [...state.matchingSteps, step],
    };
    newState = addLogEntry(newState, desc);
    pushState(newState);
  }, [state, pushState, addLogEntry]);

  const handleUndoMatchingStep = useCallback(() => {
    if (state.matchingSteps.length === 0) return;
    const lastStep = state.matchingSteps[state.matchingSteps.length - 1];
    const newState: SmithState = {
      ...state,
      points: state.points.filter(p => p.id !== lastStep.pointId),
      activePointId: state.matchingSteps.length > 1
        ? state.matchingSteps[state.matchingSteps.length - 2].pointId
        : (state.points.find(p => p.id !== lastStep.pointId)?.id || null),
      matchingSteps: state.matchingSteps.slice(0, -1),
    };
    pushState(newState);
  }, [state, pushState]);

  const handleClearMatching = useCallback(() => {
    const stepPointIds = new Set(state.matchingSteps.map(s => s.pointId));
    const newState: SmithState = {
      ...state,
      points: state.points.filter(p => !stepPointIds.has(p.id)),
      activePointId: stepPointIds.has(state.activePointId || '')
        ? (state.points.find(p => !stepPointIds.has(p.id))?.id || null)
        : state.activePointId,
      matchingSteps: [],
    };
    pushState(newState);
  }, [state, pushState]);

  const handleExportPNG = useCallback(() => {
    const canvas = canvasContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'smith_chart.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if (e.key === 'Delete' && state.activePointId) { handleDeletePoint(state.activePointId); }
      if (e.key === 'Escape') { handleSelectPoint(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, handleDeletePoint, handleSelectPoint, state.activePointId]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'input', label: 'Input' },
    { key: 'matching', label: 'Matching' },
    { key: 'points', label: 'Points' },
    { key: 'log', label: 'Solution Log' },
    { key: 'settings', label: 'Settings' },
  ];

  const modeBtn = (mode: ChartMode, label: string) => (
    <button
      key={mode}
      className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
        state.chartMode === mode
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      }`}
      onClick={() => handleChartMode(mode)}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-foreground tracking-tight smith-mono">Smith Chart</h1>
          <div className="flex gap-1 ml-4">
            {modeBtn('Z', 'Impedance')}
            {modeBtn('Y', 'Admittance')}
            {modeBtn('ZY', 'Combined')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="smith-btn-ghost text-xs" onClick={handleUndo} disabled={!history.canUndo()} title="Undo (Ctrl+Z)">↶ Undo</button>
          <button className="smith-btn-ghost text-xs" onClick={handleRedo} disabled={!history.canRedo()} title="Redo (Ctrl+Y)">↷ Redo</button>
          <button className="smith-btn-ghost text-xs" onClick={handleReset} title="Reset chart">Reset</button>
          <button
            className="smith-btn-ghost text-xs"
            onClick={() => setIsDark(d => !d)}
          >
            {isDark ? '☀' : '☾'} Theme
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chart */}
        <div ref={canvasContainerRef} className="flex-[65] min-w-0 bg-card">
          <SmithCanvas
            state={state}
            isDark={isDark}
            onClickChart={handleClickChart}
            onSelectPoint={handleSelectPoint}
            onHoverUpdate={setHoverInfo}
          />
        </div>

        {/* Right: Panels */}
        <div className="flex-[35] min-w-[280px] max-w-[420px] border-l border-border flex flex-col bg-card overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border flex-shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`flex-1 px-2 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === tab.key ? 'smith-tab smith-tab-active border-b-2' : 'smith-tab'
                }`}
                style={activeTab === tab.key ? { borderBottomColor: 'hsl(var(--tab-active))' } : {}}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.key === 'points' && state.points.length > 0 && (
                  <span className="ml-1 bg-primary/20 text-primary px-1 rounded text-[10px]">{state.points.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'input' && (
              <InputPanel state={state} onPlotPoint={handlePlotPoint} onNavigate={handleNavigate} />
            )}
            {activeTab === 'matching' && (
              <MatchingPanel
                state={state}
                onApplyStep={handleApplyMatchingStep}
                onUndoStep={handleUndoMatchingStep}
                onClearMatching={handleClearMatching}
              />
            )}
            {activeTab === 'points' && (
              <PointsPanel state={state} onSelect={handleSelectPoint} onDelete={handleDeletePoint} onRename={handleRenamePoint} />
            )}
            {activeTab === 'log' && (
              <SolutionLogPanel state={state} onGoToStep={handleGoToStep} onClearLog={handleClearLog} />
            )}
            {activeTab === 'settings' && (
              <SettingsPanel
                state={state}
                onUpdateDisplay={updates => pushState({ ...state, display: { ...state.display, ...updates } })}
                onUpdateZ0={z0 => pushState({ ...state, Z0: z0 })}
                onUpdateFrequency={(freq, unit) => pushState({ ...state, frequency: freq, frequencyUnit: unit })}
                onExportPNG={handleExportPNG}
              />
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0">
        <StatusBar info={hoverInfo} Z0={state.Z0} />
      </div>
    </div>
  );
};

export default Index;
