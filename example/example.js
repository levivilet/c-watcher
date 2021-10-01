import { spawn } from "child_process";
import { createWriteStream } from "fs";
import { mkdir, mkdtemp, rename, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import pidusage from "pidusage";
import { setTimeout } from "timers/promises";
import waitForExpect from "wait-for-expect";

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
const createWatcher = async (args = [], options = {}) => {
  const child = spawn("./hello", args, options);
  let result = "";
  child.stdout.on("data", (data) => {
    console.log(data.toString());
    result += data.toString();
  });
  await new Promise((resolve) => {
    const handleData = (data) => {
      if (data.toString().includes("Watches established.")) {
        child.stderr.off("data", handleData);
        resolve();
      }
    };
    child.stderr.on("data", handleData);
  });

  return {
    get stdout() {
      return result;
    },
    dispose() {
      child.kill();
    },
    clear() {
      result = "";
    },
    get pid() {
      return child.pid;
    },
  };
};

const main = async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const initialStats = await getStats(watcher.pid);
  for (let i = 0; i < 100; i++) {
    await mkdir(`${tmpDir}/${i}`);
  }
  await waitForExpect(() => {
    const count = watcher.stdout.split("\n").length;
    if (count !== 101) {
      // console.info("does not match", count);
      throw new Error(`mismatch ${count}`);
    }
    console.info("does match");
  }, 20_000);
  // await setTimeout(100);
  for (let i = 0; i < 2; i++) {
    await rename(`${tmpDir}/${i}`, `${tmpDir2}/${i}`);
  }
};

main();
