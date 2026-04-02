import React from 'react';
import type { SmithState, DisplaySettings, ChartMode } from '@/smith/state';

interface Props {
  state: SmithState;
  onUpdateDisplay: (updates: Partial<DisplaySettings>) => void;
  onUpdateZ0: (z0: number) => void;
  onUpdateFrequency: (freq: number | null, unit: 'MHz' | 'GHz') => void;
  onExportPNG: () => void;
}

export default function SettingsPanel({ state, onUpdateDisplay, onUpdateZ0, onUpdateFrequency, onExportPNG }: Props) {
  const toggle = (key: keyof DisplaySettings) => {
    const val = state.display[key];
    if (typeof val === 'boolean') {
      onUpdateDisplay({ [key]: !val });
    }
  };

  const checkboxRow = (key: keyof DisplaySettings, label: string) => {
    const val = state.display[key];
    if (typeof val !== 'boolean') return null;
    return (
      <label key={key} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
        <input
          type="checkbox"
          checked={val}
          onChange={() => toggle(key)}
          className="rounded border-input accent-primary"
        />
        <span className="text-foreground">{label}</span>
      </label>
    );
  };

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Reference impedance */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Reference Impedance</label>
        <div className="flex items-center gap-2">
          <input
            className="smith-input w-24"
            type="number"
            value={state.Z0}
            onChange={e => onUpdateZ0(parseFloat(e.target.value) || 1)}
          />
          <span className="text-muted-foreground">Ω</span>
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Frequency (optional)</label>
        <div className="flex items-center gap-2">
          <input
            className="smith-input w-24"
            type="number"
            value={state.frequency ?? ''}
            placeholder="—"
            onChange={e => {
              const v = parseFloat(e.target.value);
              onUpdateFrequency(isNaN(v) ? null : v, state.frequencyUnit);
            }}
          />
          <select
            className="smith-input py-1.5"
            value={state.frequencyUnit}
            onChange={e => onUpdateFrequency(state.frequency, e.target.value as 'MHz' | 'GHz')}
          >
            <option value="MHz">MHz</option>
            <option value="GHz">GHz</option>
          </select>
        </div>
      </div>

      {/* Display options */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Chart Display</label>
        <div className="space-y-0.5">
          {checkboxRow('showResistanceCircles', 'Resistance circles')}
          {checkboxRow('showReactanceArcs', 'Reactance arcs')}
          {checkboxRow('showConductanceCircles', 'Conductance circles')}
          {checkboxRow('showSusceptanceArcs', 'Susceptance arcs')}
          {checkboxRow('showOuterScales', 'Outer wavelength scales')}
          {checkboxRow('showQCircles', 'Q circles')}
          {checkboxRow('showPath', 'Show path between points')}
          {checkboxRow('gridSnap', 'Grid snap')}
        </div>
      </div>

      {/* Active point highlights */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Selected Point Highlights</label>
        <div className="space-y-0.5">
          {checkboxRow('showVswrCircle', 'VSWR circle')}
          {checkboxRow('showRCircle', 'Constant-r circle')}
          {checkboxRow('showXArc', 'Constant-x arc')}
        </div>
      </div>

      {/* Q values */}
      {state.display.showQCircles && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Q Values</label>
          <input
            className="smith-input w-full"
            value={state.display.qValues.join(', ')}
            onChange={e => {
              const vals = e.target.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
              onUpdateDisplay({ qValues: vals.length > 0 ? vals : [1] });
            }}
            placeholder="1, 2, 5"
          />
        </div>
      )}

      {/* Export */}
      <div className="border-t border-border pt-3">
        <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Export</label>
        <button className="smith-btn w-full" onClick={onExportPNG}>Export as PNG</button>
      </div>
    </div>
  );
}
