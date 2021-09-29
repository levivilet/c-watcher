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
  // const tmpDir = await getTmpDir();
  // const s = performance.now();
  // const watcher = await createWatcher([`${tmpDir}`]);
  // // await writeFile(`${tmpDir}/a.txt`, "");
  // const e = performance.now();
  // console.log(e - s);

  // const tmpDir = await getTmpDir();
  // const tmpDir2 = await getTmpDir();
  // await mkdir(`${tmpDir}/1`);
  // const watcher = await createWatcher([tmpDir]);
  // await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  // await writeFile(`${tmpDir}/3`, "");
  // await writeFile(`${tmpDir2}/1/a.txt`, "");
  // await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
  // await writeFile(`${tmpDir2}/b.txt`, "");
  // await mkdir(
  //   `${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1`,
  //   { recursive: true }
  // );

  const tmpDir = await getTmpDir();
  // const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  await mkdir(`${tmpDir}/2`);
  await writeFile(`${tmpDir}/1/a.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  // await rename(`${tmpDir}/1/a.txt`, `${tmpDir}/2/b.txt`);
  // const tmpDir = await getTmpDir();
  // const tmpDir2 = await getTmpDir();
  // await mkdir(`${tmpDir}/1`);
  // await writeFile(`${tmpDir}/1/a.txt`, "");
  // await mkdir(`${tmpDir}/2`);
  // await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  // const watcher = await createWatcher([tmpDir]);
  // await rename(`${tmpDir}/1`, `${tmpDir2}/1`);

  await setTimeout(160);
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
