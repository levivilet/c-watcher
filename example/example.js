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
  child.on("exit", (code) => {
    console.log("exit", code);
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
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a b c.txt`, "");
  console.log("watching");
  // const e = performance.now();
  // console.log(e - s);
  // const initialStats = await getStats(watcher.pid);
};

main();
