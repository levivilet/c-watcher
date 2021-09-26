import { spawn } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import waitForExpect from "wait-for-expect";

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

test("spawn", () => {
  const watcher = createWatcher();
  watcher.dispose();
});

test("create file", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`add watch ${tmpDir}
Listening for events.
event: IN_CREATE abc.txt
event: IN_CLOSE_WRITE:  abc.txt
`);
  });
  watcher.dispose();
});

test("remove file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/abc.txt`, "");
  const watcher = createWatcher([tmpDir]);
  await rm(`${tmpDir}/abc.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`add watch ${tmpDir}
Listening for events.
event: IN_DELETE abc.txt
`);
  });
  watcher.dispose();
});
