import { BikeCategory } from '../types';

export interface BikeCategoryConfig {
  category: BikeCategory;
  family: 'road' | 'gravel' | 'mtb' | 'urban' | 'bmx';
  aggressivenessBias: number;
  stackBiasMm: number;
  reachBiasMm: number;
  dropBiasMm: number;
  stemRangeMm: [number, number];
  crankBiasMm: number;
  usesDropper: boolean;
}

export const BIKE_CATEGORY_CONFIG: Record<BikeCategory, BikeCategoryConfig> = {
  'Road race': { category: 'Road race', family: 'road', aggressivenessBias: 0.85, stackBiasMm: -10, reachBiasMm: 12, dropBiasMm: 20, stemRangeMm: [100, 130], crankBiasMm: 2.5, usesDropper: false },
  'Endurance road': { category: 'Endurance road', family: 'road', aggressivenessBias: 0.45, stackBiasMm: 18, reachBiasMm: -8, dropBiasMm: -10, stemRangeMm: [80, 110], crankBiasMm: 0, usesDropper: false },
  'Aero road': { category: 'Aero road', family: 'road', aggressivenessBias: 0.95, stackBiasMm: -18, reachBiasMm: 16, dropBiasMm: 28, stemRangeMm: [100, 130], crankBiasMm: 2.5, usesDropper: false },
  'Climbing road': { category: 'Climbing road', family: 'road', aggressivenessBias: 0.75, stackBiasMm: -4, reachBiasMm: 8, dropBiasMm: 12, stemRangeMm: [90, 120], crankBiasMm: 2.5, usesDropper: false },
  'Time trial / Triathlon': { category: 'Time trial / Triathlon', family: 'road', aggressivenessBias: 1, stackBiasMm: -30, reachBiasMm: 24, dropBiasMm: 45, stemRangeMm: [80, 120], crankBiasMm: -2.5, usesDropper: false },
  'Gravel race': { category: 'Gravel race', family: 'gravel', aggressivenessBias: 0.6, stackBiasMm: 5, reachBiasMm: 2, dropBiasMm: 0, stemRangeMm: [80, 110], crankBiasMm: 0, usesDropper: false },
  'Gravel adventure': { category: 'Gravel adventure', family: 'gravel', aggressivenessBias: 0.3, stackBiasMm: 18, reachBiasMm: -12, dropBiasMm: -15, stemRangeMm: [60, 90], crankBiasMm: -2.5, usesDropper: false },
  'Cyclocross': { category: 'Cyclocross', family: 'gravel', aggressivenessBias: 0.65, stackBiasMm: 4, reachBiasMm: 4, dropBiasMm: 2, stemRangeMm: [80, 110], crankBiasMm: 0, usesDropper: false },
  'MTB XC': { category: 'MTB XC', family: 'mtb', aggressivenessBias: 0.55, stackBiasMm: 10, reachBiasMm: 10, dropBiasMm: -30, stemRangeMm: [50, 80], crankBiasMm: 0, usesDropper: true },
  'MTB Trail': { category: 'MTB Trail', family: 'mtb', aggressivenessBias: 0.35, stackBiasMm: 18, reachBiasMm: 0, dropBiasMm: -40, stemRangeMm: [40, 60], crankBiasMm: -2.5, usesDropper: true },
  'MTB All-mountain': { category: 'MTB All-mountain', family: 'mtb', aggressivenessBias: 0.3, stackBiasMm: 22, reachBiasMm: 0, dropBiasMm: -45, stemRangeMm: [35, 50], crankBiasMm: -2.5, usesDropper: true },
  'MTB Enduro': { category: 'MTB Enduro', family: 'mtb', aggressivenessBias: 0.25, stackBiasMm: 28, reachBiasMm: -2, dropBiasMm: -55, stemRangeMm: [35, 50], crankBiasMm: -5, usesDropper: true },
  'MTB Downhill': { category: 'MTB Downhill', family: 'mtb', aggressivenessBias: 0.2, stackBiasMm: 34, reachBiasMm: -8, dropBiasMm: -70, stemRangeMm: [35, 45], crankBiasMm: -5, usesDropper: true },
  'MTB Hardtail': { category: 'MTB Hardtail', family: 'mtb', aggressivenessBias: 0.4, stackBiasMm: 14, reachBiasMm: 4, dropBiasMm: -35, stemRangeMm: [40, 70], crankBiasMm: 0, usesDropper: true },
  'MTB Full-suspension': { category: 'MTB Full-suspension', family: 'mtb', aggressivenessBias: 0.35, stackBiasMm: 20, reachBiasMm: 2, dropBiasMm: -40, stemRangeMm: [40, 60], crankBiasMm: -2.5, usesDropper: true },
  'Hybrid / Fitness': { category: 'Hybrid / Fitness', family: 'urban', aggressivenessBias: 0.25, stackBiasMm: 30, reachBiasMm: -20, dropBiasMm: -25, stemRangeMm: [70, 100], crankBiasMm: 0, usesDropper: false },
  'Commuter / City': { category: 'Commuter / City', family: 'urban', aggressivenessBias: 0.15, stackBiasMm: 40, reachBiasMm: -28, dropBiasMm: -10, stemRangeMm: [60, 90], crankBiasMm: -2.5, usesDropper: false },
  'Touring': { category: 'Touring', family: 'urban', aggressivenessBias: 0.2, stackBiasMm: 28, reachBiasMm: -16, dropBiasMm: -18, stemRangeMm: [70, 100], crankBiasMm: 0, usesDropper: false },
  'Bikepacking': { category: 'Bikepacking', family: 'gravel', aggressivenessBias: 0.25, stackBiasMm: 24, reachBiasMm: -14, dropBiasMm: -18, stemRangeMm: [60, 90], crankBiasMm: -2.5, usesDropper: false },
  'BMX / Dirt jump': { category: 'BMX / Dirt jump', family: 'bmx', aggressivenessBias: 0.5, stackBiasMm: 8, reachBiasMm: -30, dropBiasMm: -5, stemRangeMm: [35, 55], crankBiasMm: -5, usesDropper: false },
};
