import { spawn } from "child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "fs/promises";
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
  const tmpDir2 = await getTmpDir();
  await writeFile(`${tmpDir}/1`, "");
  await writeFile(`${tmpDir}/2`, "");
  await writeFile(`${tmpDir}/3`, "");
  const watcher = await createWatcher([tmpDir]);
  await Promise.all([
    rename(`${tmpDir}/1`, `${tmpDir2}/1`),
    rename(`${tmpDir}/2`, `${tmpDir2}/2`),
    rename(`${tmpDir}/3`, `${tmpDir2}/3`),
  ]);

  await setTimeout(250);
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
