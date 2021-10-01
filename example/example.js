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
    console.log(result);
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
  };
};

const main = async () => {
  for (let i = 0; i < 5_000; i++) {
    const tmpDir = await getTmpDir();
    const tmpDir2 = await getTmpDir();
    await mkdir(`${tmpDir2}/1`);
    const watcher = await createWatcher([tmpDir]);
    await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
    await rename(`${tmpDir}/1`, `${tmpDir}/2`);
    await rename(`${tmpDir}/2`, `${tmpDir2}/1`);
    await setTimeout(0);
    // await waitForExpect(() => {
    //   if (
    //     !watcher.stdout.includes(`${tmpDir}/1 ISDIRMOVED_TOMOVE`) &&
    //     !watcher.stdout.includes(`${tmpDir}/1 ISDIRMOVED_FROMMOVE`) &&
    //     !watcher.stdout.includes(`${tmpDir}/2 ISDIRMOVED_TOMOVE`) &&
    //     !watcher.stdout.includes(`${tmpDir}/2 ISDIRMOVED_FROMMOVE`)
    //   ) {
    //     // console.log("\n\n\n\n\n\nn\n\\n\n\n\n\n\n\n\nnn\n\n\n\n\n\n\n\n\n\n\n");
    //     // console.log(watcher.stdout);
    //     throw new Error(`mismatch, ${watcher.stdout}`);
    //   }
    // });
    watcher.dispose();
  }
};

main();
