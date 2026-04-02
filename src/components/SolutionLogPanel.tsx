import React from 'react';
import type { SmithState, LogEntry } from '@/smith/state';

interface Props {
  state: SmithState;
  onGoToStep: (index: number) => void;
  onClearLog: () => void;
}

export default function SolutionLogPanel({ state, onGoToStep, onClearLog }: Props) {
  if (state.log.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p>No operations logged yet.</p>
        <p className="text-xs mt-1">Plot points and perform operations to build a solution log.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-3 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Solution Steps</span>
        <button className="smith-btn-ghost text-xs" onClick={onClearLog}>Clear</button>
      </div>
      <div className="flex-1 overflow-auto">
        {state.log.map((entry, i) => (
          <div
            key={entry.id}
            className="px-3 py-2 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors text-sm"
            onClick={() => onGoToStep(entry.stateSnapshotIndex)}
          >
            <span className="smith-mono text-primary font-semibold mr-1.5">①</span>
            <span className="text-foreground">{entry.text.replace(/^①\s*/, `${String.fromCodePoint(0x2460 + i)} `)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
