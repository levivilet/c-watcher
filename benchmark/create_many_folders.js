import { mkdir, rm, writeFile } from "fs/promises";
import { setTimeout } from "timers/promises";
import { createWatcher, getStats, getTmpDir } from "./_util.js";

const main = async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  for (let i = 0; i < 50_000; i++) {
    await mkdir(`${tmpDir}/${i}`);
  }
  while (watcher.stdout.split("\n").length < 50_000) {
    console.info(watcher.stdout.split("\n").length);
    await setTimeout(150);
  }
  console.info("done");
  watcher.dispose();
};

main();
