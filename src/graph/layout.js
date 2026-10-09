export const PREWARM_ALPHA_MIN = 0.02;
export const PREWARM_START_ALPHA = 1;
const PREWARM_SETTLE_TICKS = 12;

export function getLayoutPrewarmTicks(alphaDecay) {
  return (
    Math.ceil(
      Math.log(PREWARM_ALPHA_MIN / PREWARM_START_ALPHA) /
        Math.log(1 - alphaDecay),
    ) + PREWARM_SETTLE_TICKS
  );
}
