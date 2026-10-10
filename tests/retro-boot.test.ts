import { describe, expect, it } from "vitest";
import { resolveAnimation, resolveAnimationParams } from "../src/client/registry";
import {
  TIMELINE,
  buildDevourCells,
  buildDitherGrid,
  buildRetroTimeline,
  buildTunnelLayers,
  clamp01,
  mulberry32,
} from "../src/client/animations/retro-boot";

describe("retro-boot timeline", () => {
  it("advances stage starts monotonically and freezes for one second before completion", () => {
    const stageStarts = [
      TIMELINE.logoIn,
      TIMELINE.devourStart,
      TIMELINE.tunnelStart,
      TIMELINE.solidStart,
      TIMELINE.swapStart,
      TIMELINE.ditherStart,
      TIMELINE.shrinkStart,
      TIMELINE.finalStart,
      TIMELINE.total,
    ];
    for (let i = 1; i < stageStarts.length; i++) {
      expect(stageStarts[i]!).toBeGreaterThanOrEqual(stageStarts[i - 1]!);
    }
    // The tunnel deliberately overlaps the devour window; both finish before the solid frame.
    expect(TIMELINE.devourEnd).toBeGreaterThan(TIMELINE.tunnelStart);
    expect(TIMELINE.devourEnd).toBeLessThanOrEqual(TIMELINE.solidStart);
    expect(TIMELINE.total - TIMELINE.finalStart).toBe(1000);
  });

  it("scales every storyboard boundary for a custom duration", () => {
    const doubled = buildRetroTimeline(20_000);
    expect(doubled.total).toBe(20_000);
    expect(doubled.logoIn).toBe(TIMELINE.logoIn * 2);
    expect(doubled.devourEnd).toBe(TIMELINE.devourEnd * 2);
    expect(doubled.finalStart).toBe(TIMELINE.finalStart * 2);
    const halved = buildRetroTimeline(5_000);
    expect(halved.total).toBe(5_000);
    expect(halved.finalStart).toBe(TIMELINE.finalStart / 2);
    expect(halved.ditherStart).toBeLessThan(halved.shrinkStart);
    expect(halved.shrinkStart).toBeLessThan(halved.finalStart);
  });
});

describe("retro-boot devour growth", () => {
  it("covers the 1920x1080 stage with 40-60px blocks", () => {
    const cells = buildDevourCells(42);
    expect(cells.length).toBe(48 * 27);
    for (const cell of cells) {
      expect(cell.w).toBeGreaterThanOrEqual(40);
      expect(cell.w).toBeLessThanOrEqual(60);
      expect(cell.h).toBeGreaterThanOrEqual(40);
      expect(cell.h).toBeLessThanOrEqual(60);
    }
  });

  it("grows from the edges toward the center", () => {
    const cells = buildDevourCells(42);
    const edge = cells.filter((cell) => cell.x === 0 || cell.y === 0);
    const center = cells.filter((cell) => cell.x >= 800 && cell.x <= 1120 && cell.y >= 480 && cell.y <= 600);
    const mean = (list: typeof cells) => list.reduce((sum, cell) => sum + cell.birth, 0) / list.length;
    expect(mean(center)).toBeGreaterThan(mean(edge));
    // Edge cells carry wave/noise jitter but still start inside the first fifth of the window.
    expect(mean(edge)).toBeLessThan(TIMELINE.devourStart + (TIMELINE.devourEnd - TIMELINE.devourStart) / 5);
  });

  it("is reproducible per seed and varies across seeds", () => {
    const a = buildDevourCells(7);
    const a2 = buildDevourCells(7);
    const b = buildDevourCells(8);
    expect(a).toEqual(a2);
    expect(a).not.toEqual(b);
  });
});

describe("retro-boot tunnel", () => {
  it("staggered layer starts, zero layers allowed", () => {
    expect(buildTunnelLayers(42, 0)).toEqual([]);
    const layers = buildTunnelLayers(42, 5);
    expect(layers.length).toBe(5);
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i]!.start).toBeGreaterThan(layers[i - 1]!.start);
    }
  });
});

describe("retro-boot halftone grid", () => {
  it("keeps only cross cells in the left sheet and only box cells in the right one", () => {
    const cells = buildDitherGrid(42);
    for (const cell of cells) {
      if (cell.keep === 0) expect(cell.pattern).toBe(0);
      if (cell.keep === 1) expect(cell.pattern).toBe(1);
    }
    expect(cells.some((cell) => cell.keep === 0)).toBe(true);
    expect(cells.some((cell) => cell.keep === 1)).toBe(true);
  });

  it("sweeps in from the top-right and dissolves non-kept cells during the shrink", () => {
    const cells = buildDitherGrid(42).slice().sort((left, right) => left.birth - right.birth);
    const first = cells[0]!;
    expect(first.x).toBeGreaterThan(1600);
    expect(first.y).toBeLessThan(400);
    for (const cell of cells) {
      if (cell.keep < 0) expect(cell.death).toBeGreaterThanOrEqual(TIMELINE.shrinkStart);
    }
  });
});

describe("retro-boot params schema", () => {
  it("exposes the end-of-run mask strength default", () => {
    expect(resolveAnimationParams(resolveAnimation("image", "retro-boot")!).finalMask).toBe(0.65);
  });
});

describe("retro-boot deterministic helpers", () => {
  it("clamps to [0, 1] and repeats the PRNG stream for the same seed", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(mulberry32(9)()).toBe(mulberry32(9)());
  });
});
