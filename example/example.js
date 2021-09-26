import { spawn } from "child_process";
import { mkdir, mkdtemp } from "fs/promises";
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
  const watcher = createWatcher([tmpDir]);
  await mkdir(`${tmpDir}/a`);
  await shortTimeout();
  console.log(watcher.stdout);
  //   expect(watcher.stdout).toBe(`${tmpDir}/a IN_CREATEIN_ISDIR
  // `);
  watcher.dispose();
};

main();
