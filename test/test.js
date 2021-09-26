import { spawn } from "child_process";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import waitForExpect from "wait-for-expect";
import { setTimeout } from "timers/promises";

waitForExpect.defaults.timeout = 100;

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
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt IN_CREATE
${tmpDir}/abc.txt IN_CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("create file - nested", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt IN_CREATE
${tmpDir}/a/abc.txt IN_CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("modify file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/abc.txt`, "");
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/abc.txt`, "abc");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt IN_CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("modify file - nested", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  await writeFile(`${tmpDir}/a/abc.txt`, "");
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt IN_CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt IN_DELETE
`);
  });
  watcher.dispose();
});

test("remove file - nested", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  await writeFile(`${tmpDir}/a/abc.txt`, "");
  const watcher = createWatcher([tmpDir]);
  await rm(`${tmpDir}/a/abc.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt IN_DELETE
`);
  });
  watcher.dispose();
});

test("create folder", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await mkdir(`${tmpDir}/a`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a IN_CREATEIN_ISDIR
`);
  });
  watcher.dispose();
});

test("create folder - nested", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await mkdir(`${tmpDir}/a`);
  await mkdir(`${tmpDir}/a/b`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a IN_CREATEIN_ISDIR
${tmpDir}/a/b IN_CREATEIN_ISDIR
`);
  });
  watcher.dispose();
});

test("remove folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  const watcher = createWatcher([tmpDir]);
  await rm(`${tmpDir}/a`, { recursive: true });
  // TODO why is there a second line?
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a IN_DELETEIN_ISDIR
${tmpDir}/a/
`);
  });
  watcher.dispose();
});

test("remove folder - nested", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  await mkdir(`${tmpDir}/a/b`);
  const watcher = createWatcher([tmpDir]);
  await rm(`${tmpDir}/a/b`, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/b IN_DELETEIN_ISDIR
${tmpDir}/a/b/
`);
  });
  watcher.dispose();
});
