/** Luck pot growth: the stage index and how many more finds reach the next one. */
export const POT_STAGES = [0, 1, 3, 6, 12, 20] as const;

export function potStage(finds: number) {
  let stage = 0;
  POT_STAGES.forEach((min, i) => {
    if (finds >= min) stage = i;
  });
  const next = POT_STAGES[stage + 1];
  return { stage, toNext: next === undefined ? 0 : next - finds };
}
