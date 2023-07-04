import { spawn } from "node:child_process";
import { execa } from "execa";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pidusage from "pidusage";

const exec = async (file, args) => {
  await execa(file, args);
};

const getStats = async (pid) => {
  const stats = await pidusage(pid);
  return stats;
};

const getTmpDir = () => {
  return mkdtemp(join(tmpdir(), "foo-"));
};

const waitForWatcherReady = async (child) => {
  await new Promise((resolve) => {
    const cleanup = () => {
      child.stderr.off("data", handleData);
      resolve(undefined);
    };
    const handleData = (data) => {
      if (data.toString().includes("Watches established.")) {
        cleanup();
      }
    };
    child.stderr.on("data", handleData);
  });
};

/**
 *
 * @param {readonly string[]} args
 * @param {import('child_process').SpawnOptions} options
 * @returns
 */
const createWatcher = async (args = [], options = {}) => {
  const child = spawn("./hello", args, options);
  if (!child.stdout) {
    throw new Error(`stdout is not available`);
  }
  let result = "";
  child.stdout.on("data", (data) => {
    console.log(data.toString());
    result += data.toString();
  });
  child.on("exit", (code) => {
    console.log("exit", code);
  });
  await waitForWatcherReady(child);

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
  await mkdir(`${tmpDir}/b`);
  const s = performance.now();
  const watcher = await createWatcher(["/home/simon"]);
  console.log(performance.now() - s);
};

main();
