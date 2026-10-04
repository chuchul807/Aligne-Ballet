import { cp, mkdir, rm } from 'node:fs/promises';

const wasmSource = new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url);
const wasmDestination = new URL('../public/vendor/mediapipe/wasm/', import.meta.url);
const legacyLocalModel = new URL('../public/models/pose_landmarker_heavy.task', import.meta.url);

await mkdir(wasmDestination, { recursive: true });
await cp(wasmSource, wasmDestination, { recursive: true });
await rm(legacyLocalModel, { force: true });
