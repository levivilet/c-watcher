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
const createWatcher = (args = [], options = {}) => {
  const child = spawn("./hello", args, options);
  let result = "";
  child.stdout.on("data", (data) => {
    result += data.toString();
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
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/new`);
  const watcher = createWatcher([tmpDir]);
  await rename(`${tmpDir2}/new`, `${tmpDir}/new`);
  await writeFile(`${tmpDir}/new/abc.txt`, "");

  setTimeout(1000);
  console.log(watcher.stdout);
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
