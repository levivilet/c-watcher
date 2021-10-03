import { spawn } from "child_process";
import execa from "execa";
import { mkdir, mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
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
  await Promise.all([
    mkdir(`${tmpDir}/a/a/a`, { recursive: true }),
    mkdir(`${tmpDir}/b/b/b`, { recursive: true }),
    mkdir(`${tmpDir}/c/c/c`, { recursive: true }),
    mkdir(`${tmpDir}/d/d/d`, { recursive: true }),
  ]);
  const watcher = await createWatcher([
    tmpDir,
    "--exclude",
    "a",
    "--exclude",
    "b",
    "--exclude",
    "c",
  ]);
  await writeFile(`${tmpDir}/a/1.txt`, "");
  await writeFile(`${tmpDir}/b/1.txt`, "");
  await writeFile(`${tmpDir}/c/1.txt`, "");
  await writeFile(`${tmpDir}/d/1.txt`, "");
  await writeFile(`${tmpDir}/1.txt`, "");
  await writeFile(`${tmpDir}/d/1.txt`, "");
  // console.log(watcher.stdout);
};

main();
