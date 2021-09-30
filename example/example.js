import { spawn } from "child_process";
import { createWriteStream } from "fs";
import { mkdir, mkdtemp, rename, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import pidusage from "pidusage";
import { setTimeout } from "timers/promises";

const getStats = async (pid) => {
  const stats = await pidusage(pid);
  return stats;
};

const getTmpDir = () => {
  return mkdtemp(join(tmpdir(), "foo-"));
};

/**
 *
 * @param {readonly string[]} args
 * @param {import('child_process').SpawnOptions} options
 * @returns
 */
export const createWatcher = async (args = [], options = {}) => {
  const child = spawn("./hello", args, options);
  const stream = createWriteStream("./out.txt");
  child.stdout.on("data", (data) => {
    stream.write(data);
  });

  await new Promise((resolve) => {
    const handleData = (data) => {
      console.log(data.toString());
      if (data.toString().includes("Watches established.")) {
        child.stderr.off("data", handleData);
        resolve();
      }
    };
    child.stderr.on("data", handleData);
  });

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
  child.on("disconnect", (code) => {
    console.info("disconnect", code);
  });
  child.on("exit", (code) => {
    console.info("child exit", code);
    // console.log(result);
  });
  return {
    dispose() {
      child.kill();
    },
    get pid() {
      return child.pid;
    },
  };
};

const main = async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const initialStats = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/1-${i}`);
  }
  const middleStats1 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rm(`${tmpDir}/1-${i}`, { recursive: true });
  }
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/2-${i}`);
  }
  const middleStats2 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rm(`${tmpDir}/2-${i}`, { recursive: true });
  }
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/3-${i}`);
  }
  const middleStats3 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rm(`${tmpDir}/3-${i}`, { recursive: true });
  }
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/4-${i}`);
  }
  const middleStats4 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rm(`${tmpDir}/4-${i}`, { recursive: true });
  }
  await setTimeout(1000);
  const finalStats = await getStats(watcher.pid);
  console.info(`memory before: ${initialStats.memory}`);
  console.info(`memory middle 1: ${middleStats1.memory}`);
  console.info(`memory middle 2: ${middleStats2.memory}`);
  console.info(`memory middle 3: ${middleStats3.memory}`);
  console.info(`memory middle 4: ${middleStats4.memory}`);
  console.info(`memory after: ${finalStats.memory}`);
};

main();
