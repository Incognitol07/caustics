/**
 * Damped spring integrator (semi-implicit Euler, unit mass). Drives the
 * liquid feel: lens position, squash, and press swell all animate through
 * springs so they lag, overshoot, and wobble to a stop instead of snapping.
 *
 * Damping below 2 * sqrt(stiffness) is underdamped (wobbly); above it the
 * spring settles without overshoot.
 */
export class Spring {
  velocity = 0;
  target: number;

  constructor(
    public value: number,
    public stiffness: number,
    public damping: number,
  ) {
    this.target = value;
  }

  step(dt: number): void {
    const acceleration =
      this.stiffness * (this.target - this.value) - this.damping * this.velocity;
    this.velocity += acceleration * dt;
    this.value += this.velocity * dt;
  }

  get settled(): boolean {
    return (
      Math.abs(this.velocity) < 0.01 && Math.abs(this.target - this.value) < 0.01
    );
  }
}
