import { spawn } from "child_process";
import execa from "execa";
import { mkdir, mkdtemp, rename, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import pidusage from "pidusage";
import { setTimeout } from "timers/promises";

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
  await mkdir(`${tmpDir}/b`);
  const watcher = await createWatcher([tmpDir, "--exclude", "a"]);
  await rename(`${tmpDir}/b`, `${tmpDir}/a`);
  //   await waitForExpect(() => {
  //     expect(watcher.stdout).toBe(`${tmpDir}/b,MOVED_FROM_DIR
  // ${tmpDir}/a,MOVED_TO_DIR
  // `);
  //   });
  // watcher.clear();
  await writeFile(`${tmpDir}/a/a.txt`, "");
  await writeFile(`${tmpDir}/c.txt`, "");
  //   await waitForExpect(() => {
  //     expect(watcher.stdout).toBe(`
  // `);
  //   });
  //   await waitForExpect(() => {
  //     expect(watcher.stdout).toBe(`${tmpDir}/b/b.txt,CREATE
  // ${tmpDir}/b/b.txt,CLOSE_WRITE
  // `);
  //   });
  // console.log(watcher.stdout);
};

main();
