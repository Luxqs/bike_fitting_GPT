# BikeFit Camera MVP

BikeFit Camera is a browser-based MVP that helps riders estimate fit dimensions for a new bike using a phone or laptop camera plus a guided measurement flow.

## Important safety note
This is a comfort/performance estimation tool, **not a medical device**. Final bike selection should be validated by a professional fitter, especially if the rider has pain, injuries, asymmetries, or persistent discomfort.

## MVP scope
This MVP includes:
- React + TypeScript + Vite frontend
- In-browser MediaPipe pose landmark detection
- Manual calibration step using a known reference object
- Guided front and side capture flow
- Multi-step rider profile and issue collection
- Transparent rule-based fit engine with config-driven modifiers
- Results dashboard with confidence scores and PDF export

## Hardening pass included
This repository now also includes:
- localStorage-backed wizard state persistence
- safer camera initialization and overlay-loop guarding
- retry / pause / skip controls in the capture wizard
- a Vite environment declaration file
- a basic `.gitignore`
- a `typecheck` npm script

## Approximate parts in MVP
- Absolute lengths depend on calibration quality and camera alignment
- Calibration is manual-first in this MVP; automatic A4/card/ArUco detection is a future enhancement
- Pose fusion and asymmetry detection are conservative and simplified
- Fit outputs are sizing-oriented starting points, not a dynamic pedaling fit

## Future improvements
- Automatic calibration object detection with OpenCV.js / ArUco
- Better frame smoothing and temporal filtering
- Side/front fusion with anthropometric priors
- Bike-geometry import and brand-specific size matching
- Persisted sessions and comparison mode
- Audio prompts and accessibility improvements

## Setup
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Type-check only
```bash
npm run typecheck
```

## Notes for first run
- Use a modern Chromium-based browser or Safari with camera access enabled.
- The first camera start can take a moment while the MediaPipe model is loaded.
- HTTPS or localhost is typically required for camera permissions.

## Architecture summary
- `src/features/camera`: pose estimation and frame capture
- `src/features/calibration`: scale calibration workflow
- `src/features/measurements`: anthropometric estimation from landmarks
- `src/features/fit-engine`: config-driven fit calculation engine
- `src/features/results`: export logic
- `src/config`: bike categories, formulas, issues, capture protocol
- `src/types`: core data model

## Privacy
The app is designed to keep processing local in the browser. Camera frames are not uploaded by default.
