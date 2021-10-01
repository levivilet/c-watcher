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
  };
};

const main = async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/1`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
  // TODO test with fast creation of nested folder 1/2/3/4/5/6/7/8/9/10/11/12
  await mkdir(`${tmpDir}/1/2`);
  await rename(`${tmpDir}/1`, `${tmpDir2}/1`);
  await writeFile(`${tmpDir2}/1/2/3.txt`, "");
  await setTimeout(100);
  // console.log(watcher.stdout);
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
  // watcher.dispose();
};

main();
