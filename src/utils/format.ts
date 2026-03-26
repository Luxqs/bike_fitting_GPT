export const formatRange = (center: number, spread: number, unit: string) => `${Math.round(center - spread)}–${Math.round(center + spread)} ${unit}`;
export const formatValue = (value: number, unit: string) => `${Math.round(value)} ${unit}`;
export const percent = (value: number) => `${Math.round(value * 100)}%`;
