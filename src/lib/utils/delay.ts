export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const randomBetween = (min: number, max: number): number => {
  const safeMin = Math.max(0, Math.floor(min));
  const safeMax = Math.max(safeMin, Math.floor(max));
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
};
