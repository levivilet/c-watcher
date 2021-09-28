import { spawn } from "child_process";
import { mkdir, mkdtemp, rename, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { setTimeout } from "timers/promises";

const getTmpDir = () => {
  return mkdtemp(join(tmpdir(), "foo-"));
};

const shortTimeout = () => setTimeout(0);

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
    result += data.toString();
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

  return {
    get stdout() {
      return result;
    },
    dispose() {
      child.kill();
    },
  };
};

const main = async () => {
  const tmpDir = await getTmpDir();
  const s = performance.now();
  const watcher = await createWatcher([`${tmpDir}`]);
  // await writeFile(`${tmpDir}/a.txt`, "");
  const e = performance.now();
  console.log(e - s);
  // await mkdir(
  //   `${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1`,
  //   { recursive: true }
  // );
  await setTimeout(100);
  console.log(watcher.stdout);
  // await rename(`${tmpDir}/old`, `${tmpDir2}/new`);
  // await writeFile(`${tmpDir}/old/abc.txt`, "");

  // setTimeout(1000);
  // console.log(watcher.stdout);
  //   await waitForExpect(() => {
  //     expect(watcher.stdout).toBe(`${tmpDir}/new ISDIR
  // ${tmpDir}/.abc.txt CREATE
  // ${tmpDir}/.abc.txt CLOSE_WRITE
  // `);
  //   });
  // watcher.dispose();
  watcher.dispose();
};

main();
