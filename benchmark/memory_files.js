import { writeFile } from "fs/promises";
import { createWatcher, getStats, getTmpDir } from "./_util.js";

// memory should stay the same when creating files
const main = async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const initialStats = await getStats(watcher.pid);
  const initialMemory = initialStats.memory;
  for (let i = 0; i < 10_000; i++) {
    await writeFile(`${tmpDir}/${i}.txt`, "");
  }
  const finalStats = await getStats(watcher.pid);
  const finalMemory = finalStats.memory;
  console.info(`memory before: ${initialMemory}`);
  console.info(`memory after: ${finalMemory}`);
  console.info(`Event count: ${watcher.stdout.split("\n").length}`);
  watcher.dispose();
};

main();
