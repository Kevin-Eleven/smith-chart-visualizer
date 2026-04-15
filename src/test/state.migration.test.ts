import { beforeEach, describe, expect, it } from "vitest";
import { Complex } from "@/smith/math";
import {
  createDefaultState,
  loadStateFromStorage,
  saveStateToStorage,
  type SmithState,
} from "@/smith/state";

describe("smith state migrations", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates legacy saved state to multi-active and per-point highlight settings", () => {
    const legacyState = {
      points: [
        {
          id: "p1",
          label: "P1",
          gamma: { re: 0.25, im: -0.1 },
          color: "#3b82f6",
        },
        {
          id: "p2",
          label: "P2",
          gamma: { re: -0.1, im: 0.35 },
          color: "#ef4444",
        },
      ],
      activePointId: "p2",
      chartMode: "Z",
      Z0: 50,
      frequency: null,
      frequencyUnit: "GHz",
      display: {
        showResistanceCircles: true,
        showReactanceArcs: true,
        showConductanceCircles: true,
        showSusceptanceArcs: true,
        showVswrCircle: false,
        showRCircle: true,
        showXArc: false,
        showOuterScales: true,
        showQCircles: false,
        showPath: true,
        gridSnap: false,
        qValues: [1, 2, 5],
      },
      log: [],
      matchingSteps: [],
    };

    localStorage.setItem("smithChart_state", JSON.stringify(legacyState));

    const loaded = loadStateFromStorage();

    expect(loaded).not.toBeNull();
    expect(loaded?.activePointId).toBe("p2");
    expect(loaded?.activePointIds).toEqual(["p2"]);

    for (const point of loaded?.points ?? []) {
      expect(point.highlightSettings).toEqual({
        showVswrCircle: false,
        showRCircle: true,
        showXArc: false,
      });
    }
  });

  it("persists independent highlight settings per active point", () => {
    const state: SmithState = {
      ...createDefaultState(),
      points: [
        {
          id: "p1",
          label: "P1",
          gamma: new Complex(0.1, 0.2),
          color: "#3b82f6",
          highlightSettings: {
            showVswrCircle: true,
            showRCircle: false,
            showXArc: true,
          },
        },
        {
          id: "p2",
          label: "P2",
          gamma: new Complex(-0.25, 0.15),
          color: "#ef4444",
          highlightSettings: {
            showVswrCircle: false,
            showRCircle: true,
            showXArc: false,
          },
        },
      ],
      activePointId: "p1",
      activePointIds: ["p1", "p2"],
    };

    saveStateToStorage(state);
    const loaded = loadStateFromStorage();

    expect(loaded).not.toBeNull();
    expect(loaded?.activePointIds).toEqual(["p1", "p2"]);

    const p1 = loaded?.points.find((p) => p.id === "p1");
    const p2 = loaded?.points.find((p) => p.id === "p2");

    expect(p1?.highlightSettings).toEqual({
      showVswrCircle: true,
      showRCircle: false,
      showXArc: true,
    });
    expect(p2?.highlightSettings).toEqual({
      showVswrCircle: false,
      showRCircle: true,
      showXArc: false,
    });
  });
});
