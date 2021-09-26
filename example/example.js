import { spawn } from "child_process";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const getTmpDir = () => {
  return mkdtemp(join(tmpdir(), "foo-"));
};

/**
 *
 * @param {readonly string[]} args
 * @param {import('child_process').SpawnOptions} options
 * @returns
 */
const createWatcher = (args = [], options = {}) => {
  const child = spawn("./hello", args, options);
  return child;
};

const main = async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir], {
    // stdio: ["ignore", "inherit", "ignore"],
  });

  watcher.stdout.on("data", (data) => {
    console.log("got data", data.toString());
  });

  let result = "";
  // watcher.stderr.on("data", (data) => {
  //   console.log("got data 2");
  // });
  // watcher.stdout.on("data", (data) => {
  //   console.log("got stdout data");
  //   result += data.toString();
  // });
  await writeFile(`${tmpDir}/abc.txt`, "");
  // await new Promise((r) =>
  //   setTimeout(() => {
  //     r();
  //   }, 1000)
  // );
  // await waitForExpect(() => {
  //   expect(result).toBe(`ab`);
  // });
  // watcher.kill();
};

main();
