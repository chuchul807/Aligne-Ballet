import { access, cp, mkdir, rename, writeFile } from 'node:fs/promises';

const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';
const wasmSource = new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url);
const wasmDestination = new URL('../public/vendor/mediapipe/wasm/', import.meta.url);
const modelDirectory = new URL('../public/models/', import.meta.url);
const modelPath = new URL('pose_landmarker_heavy.task', modelDirectory);

await mkdir(wasmDestination, { recursive: true });
await cp(wasmSource, wasmDestination, { recursive: true });

try {
  await access(modelPath);
} catch {
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Could not download the MediaPipe pose model: ${response.status} ${response.statusText}`);
  }

  const temporaryModelPath = new URL(`pose_landmarker_heavy.task.${process.pid}.tmp`, modelDirectory);
  await mkdir(modelDirectory, { recursive: true });
  await writeFile(temporaryModelPath, new Uint8Array(await response.arrayBuffer()));
  await rename(temporaryModelPath, modelPath);
}
