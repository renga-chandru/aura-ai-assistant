/**
 * Animation Choreography & State Easing Specifications
 * Phase 1 Contract Definitions
 */
export interface MotionParameters {
  damping: number;
  stiffness: number;
  mass: number;
  durationSeconds: number;
}

export const STATE_TRANSITION_SPRING: MotionParameters = {
  damping: 18,
  stiffness: 120,
  mass: 1.0,
  durationSeconds: 0.8,
};
