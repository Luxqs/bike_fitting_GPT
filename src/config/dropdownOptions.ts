import { AgeRange, BiologicalSexOption, BikeCategory, CurrentBikeType, RideType, TerrainOption } from '../types';

export const AGE_RANGE_OPTIONS: AgeRange[] = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

export const BIOLOGICAL_SEX_OPTIONS: BiologicalSexOption[] = [
  'Female',
  'Male',
  'Intersex / another variation',
  'Prefer not to say',
];

export const RIDE_TYPE_OPTIONS: RideType[] = [
  'Comfort / leisure',
  'Endurance / long rides',
  'Race / fast group rides',
  'Training / fitness',
  'Adventure / mixed terrain',
  'Commuting / utility',
  'Trail / technical fun',
  'Downhill / gravity',
];

export const TERRAIN_OPTIONS: TerrainOption[] = [
  'Paved road',
  'Mixed road',
  'Gravel / dirt roads',
  'Singletrack / trail',
  'Bike park / downhill',
  'Urban / city',
  'Touring / loaded mixed terrain',
];

export const CURRENT_BIKE_TYPE_OPTIONS: CurrentBikeType[] = [
  'Road',
  'Triathlon / TT',
  'Gravel',
  'Cyclocross',
  'MTB XC',
  'MTB Trail',
  'MTB Enduro / Downhill',
  'Hybrid / Fitness',
  'Commuter / City',
  'Touring / Bikepacking',
  'BMX / Dirt jump',
  'Other / unsure',
];

export const BIKE_CATEGORY_GROUPS: Array<{ label: string; options: BikeCategory[] }> = [
  {
    label: 'Road',
    options: ['Road race', 'Endurance road', 'Aero road', 'Climbing road', 'Time trial / Triathlon'],
  },
  {
    label: 'Gravel / CX',
    options: ['Gravel race', 'Gravel adventure', 'Cyclocross', 'Bikepacking'],
  },
  {
    label: 'Mountain bike',
    options: ['MTB XC', 'MTB Trail', 'MTB All-mountain', 'MTB Enduro', 'MTB Downhill', 'MTB Hardtail', 'MTB Full-suspension'],
  },
  {
    label: 'Urban / touring',
    options: ['Hybrid / Fitness', 'Commuter / City', 'Touring'],
  },
  {
    label: 'BMX / gravity park',
    options: ['BMX / Dirt jump'],
  },
];
