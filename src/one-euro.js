/**
 * 1€ filter (Casiez, Roussel & Vogel, 2012).
 * Adaptive low-pass: heavy smoothing while the hand is still, light smoothing
 * while it moves, which keeps the cursor calm without feeling laggy.
 */

function smoothingFactor(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

class LowPass {
  constructor() {
    this.value = null;
  }

  filter(x, alpha) {
    this.value = this.value === null ? x : alpha * x + (1 - alpha) * this.value;
    return this.value;
  }

  reset() {
    this.value = null;
  }
}

export class OneEuroFilter {
  constructor({ minCutoff = 1, beta = 0, dCutoff = 1 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
  }

  filter(value, dt) {
    if (!(dt > 0)) dt = 1 / 60;
    const previous = this.x.value;
    const derivative = previous === null ? 0 : (value - previous) / dt;
    const edx = this.dx.filter(derivative, smoothingFactor(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, smoothingFactor(cutoff, dt));
  }

  reset() {
    this.x.reset();
    this.dx.reset();
  }
}

/** Two 1€ filters wired to an (x, y) pair. */
export class PointFilter {
  constructor(options) {
    this.fx = new OneEuroFilter(options);
    this.fy = new OneEuroFilter(options);
  }

  filter(x, y, dt) {
    return { x: this.fx.filter(x, dt), y: this.fy.filter(y, dt) };
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
  }
}
