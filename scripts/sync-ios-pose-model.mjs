import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';

const expectedSHA256 = '64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b';
const modelURL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';
const webModel = new URL('../public/models/pose_landmarker_heavy.task', import.meta.url);
const iosModel = new URL('../ios/AligneBallet/AligneBallet/Models/pose_landmarker_heavy.task', import.meta.url);

function verified(data) {
  const actual = createHash('sha256').update(data).digest('hex');
  if (actual !== expectedSHA256) throw new Error(`Pose model SHA-256 mismatch: ${actual}`);
  return data;
}

let bytes;
try {
  await access(webModel);
  bytes = verified(await readFile(webModel));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const response = await fetch(modelURL);
  if (!response.ok) throw new Error(`Could not download pose model: ${response.status}`);
  bytes = verified(Buffer.from(await response.arrayBuffer()));
}

await mkdir(new URL('.', iosModel), { recursive: true });
const temporary = new URL(`pose_landmarker_heavy.task.${process.pid}.tmp`, new URL('.', iosModel));
await writeFile(temporary, bytes);
await rename(temporary, iosModel);
console.log(`Verified iOS pose model (${bytes.length} bytes, SHA-256 ${expectedSHA256})`);
