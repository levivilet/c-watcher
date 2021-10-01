import { mkdir, rename, rm, writeFile } from "fs/promises";
import { setTimeout } from "timers/promises";
import { createWatcher, getStats, getTmpDir } from "./_util.js";

// memory should increase when creating folders
// and decrease when folders are removed
const main = async () => {
  const RUNS = 5_000;
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const initialStats = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await mkdir(`${tmpDir}/1-${i}`);
  }
  await setTimeout(1000);
  const middleStats1 = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await rename(`${tmpDir}/1-${i}`, `${tmpDir2}/1-${i}`);
  }
  for (let i = 0; i < RUNS; i++) {
    await mkdir(`${tmpDir}/2-${i}`);
  }
  await setTimeout(1000);
  const middleStats2 = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await rename(`${tmpDir}/2-${i}`, `${tmpDir2}/2-${i}`);
  }
  for (let i = 0; i < RUNS; i++) {
    await mkdir(`${tmpDir}/3-${i}`);
  }
  await setTimeout(1000);
  const middleStats3 = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await rename(`${tmpDir}/3-${i}`, `${tmpDir2}/3-${i}`);
  }
  for (let i = 0; i < RUNS; i++) {
    await mkdir(`${tmpDir}/4-${i}`);
  }
  await setTimeout(1000);
  const middleStats4 = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await rename(`${tmpDir}/4-${i}`, `${tmpDir2}/4-${i}`);
  }
  const finalStats = await getStats(watcher.pid);
  console.info(`memory before: ${initialStats.memory}`);
  console.info(`memory middle 1: ${middleStats1.memory}`);
  console.info(`memory middle 2: ${middleStats2.memory}`);
  console.info(`memory middle 3: ${middleStats3.memory}`);
  console.info(`memory middle 4: ${middleStats4.memory}`);
  console.info(`memory after: ${finalStats.memory}`);
  console.info(`Event count: ${watcher.stdout.split("\n").length}`);
  watcher.dispose();
};

main();
