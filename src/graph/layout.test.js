import {
  getLayoutPrewarmTicks,
  PREWARM_ALPHA_MIN,
  PREWARM_START_ALPHA,
} from "./layout";

test.each([
  [0.04, 108],
  [0.032, 133],
])("prewarms through cooling and settling at alphaDecay %s", (alphaDecay, ticks) => {
  expect(getLayoutPrewarmTicks(alphaDecay)).toBe(ticks);
  expect(
    PREWARM_START_ALPHA * Math.pow(1 - alphaDecay, ticks),
  ).toBeLessThan(PREWARM_ALPHA_MIN);
});
