export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export const round = (value: number, precision = 0) => {
  const p = Math.pow(10, precision);
  return Math.round(value * p) / p;
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
