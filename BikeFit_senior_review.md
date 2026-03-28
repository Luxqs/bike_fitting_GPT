# BikeFit Camera senior code review

I inspected the current repository and focused on the highest-impact MVP problems.

## What I found

### 1) Measurement estimation uses the wrong frames
The current estimator averages leg and torso lengths across all side-view stages, including squat and hip-hinge stages. That shrinks effective segment lengths and can distort inseam, torso, and lower-limb outputs.

### 2) Fit fallbacks can collapse to unrealistic values
If inseam or torso is missing, the current fit engine can end up using `0` for some core derived values. That can produce invalid frame size or cockpit recommendations.

### 3) Camera initialization is fragile
The pose hook currently hardcodes GPU delegation. On some browsers/devices that fails even though CPU would work. There is also no landmark smoothing buffer.

### 4) PDF export is too thin
The current export leaves out the measurement provenance, assumptions, and detailed warnings that are central to the product promise.

### 5) App-level issues still worth fixing
I did not rewrite the whole `src/App.tsx`, but there are two notable UX/data issues that should be patched next:
- blank numeric inputs are converted with `Number('')` into `0`
- selecting **No issues, just sizing a new bike** can coexist with other pain points

## Included improved files

These replacements are included in this patch bundle:

- `src/features/camera/usePoseCapture.ts`
- `src/features/measurements/estimateMeasurements.ts`
- `src/features/fit-engine/calculateFit.ts`
- `src/features/results/exportPdf.ts`
- `src/features/calibration/CalibrationPanel.tsx`

## Recommended next App.tsx fixes

### Safer optional numeric parsing
Use a helper like:

```ts
const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};
```

Then replace `Number(e.target.value)` for optional fields with `parseOptionalNumber(e.target.value)`.

### Fix pain-point exclusivity
When checking **No issues, just sizing a new bike**, it should clear all other selected issues.
When checking any other issue, it should remove **No issues...**.

## What is now materially better with this patch

- pose initialization falls back from GPU to CPU
- recent landmarks are smoothed across a short history window
- measurements are estimated from stage-appropriate frames instead of all frames
- fit calculations now use anthropometric fallbacks instead of zeroing out core dimensions
- handlebar width is category-aware, so MTB and flat-bar families no longer inherit road-bar assumptions
- dropper travel is dynamic instead of hardcoded
- export PDF now includes recommendations, measurement sources, assumptions, and warnings

## Still approximate / future work

- automatic A4 / card / ArUco detection is still not implemented
- there is still no bike-geometry database or brand/frame-size matcher
- the rider-profile form still does not fully capture all current-bike data from the original product spec
- pose confidence and asymmetry logic are still simplified MVP heuristics
