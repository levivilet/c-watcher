import { mkdir, rm, writeFile } from "fs/promises";
import { setTimeout } from "timers/promises";
import { createWatcher, getStats, getTmpDir } from "./_util.js";

// memory should increase when creating folders
// and decrease when folders are removed
const main = async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const initialStats = await getStats(watcher.pid);
  for (let i = 0; i < 10_000; i++) {
    await mkdir(`${tmpDir}/${i}`);
  }
  const middleStats = await getStats(watcher.pid);
  for (let i = 0; i < 10_000; i++) {
    await rm(`${tmpDir}/${i}`, { recursive: true });
  }
  while (watcher.stdout.split("\n").length < 20_000) {
    await setTimeout(150);
  }
  const finalStats = await getStats(watcher.pid);
  console.info(`memory before: ${initialStats.memory}`);
  console.info(`memory middle: ${middleStats.memory}`);
  console.info(`memory after: ${finalStats.memory}`);
  console.info(`Event count: ${watcher.stdout.split("\n").length}`);
  await writeFile("./out.txt", watcher.stdout);
  // watcher.dispose();
};

main();
