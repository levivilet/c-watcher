import { spawn } from "child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import waitForExpect from "wait-for-expect";
import isCi from "is-ci";

waitForExpect.defaults.timeout = 200;

if (isCi) {
  waitForExpect.defaults.timeout *= 5;
}

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
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt CREATE
${tmpDir}/abc.txt CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt CREATE
${tmpDir}/a/abc.txt CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt DELETE
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
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt DELETE
`);
  });
  watcher.dispose();
});

test("create folder", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await mkdir(`${tmpDir}/a`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a CREATEISDIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/a CREATEISDIR
${tmpDir}/a/b CREATEISDIR
`);
  });
  watcher.dispose();
});

test("remove folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  const watcher = createWatcher([tmpDir]);
  await rm(`${tmpDir}/a`, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a DELETEISDIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/a/b DELETEISDIR
`);
  });
  watcher.dispose();
});

test("misc - add and remove file", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/abc.txt`, "");
  await rm(`${tmpDir}/abc.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt CREATE
${tmpDir}/abc.txt CLOSE_WRITE
${tmpDir}/abc.txt DELETE
`);
  });
  watcher.dispose();
});

test("misc - file with spaces", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a b c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a b c.txt CREATE
${tmpDir}/a b c.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - file with comma", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a,b,c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,b,c.txt CREATE
${tmpDir}/a,b,c.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - file with newline", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a\nb\nc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a\nb\nc.txt CREATE
${tmpDir}/a\nb\nc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - file with quotes", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a"b"c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a"b"c.txt CREATE
${tmpDir}/a"b"c.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - file with dot at start", async () => {
  const tmpDir = await getTmpDir();
  const watcher = createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/.abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/.abc.txt CREATE
${tmpDir}/.abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("move in - file", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await writeFile(`${tmpDir2}/old.txt`, "");
  const watcher = createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old.txt`, `${tmpDir}/new.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new.txt MOVED_TO
`);
  });
  watcher.dispose();
});

test("move in - folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/old`);
  const watcher = createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old`, `${tmpDir}/new`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new ISDIRMOVED_TO
`);
  });
  watcher.dispose();
});

test("misc - move in file, then remove file", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await writeFile(`${tmpDir2}/old.txt`, "");
  const watcher = createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old.txt`, `${tmpDir}/new.txt`);
  await rm(`${tmpDir}/new.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new.txt MOVED_TO
${tmpDir}/new.txt DELETE
`);
  });
  watcher.dispose();
});

test("misc - move in folder, then remove folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/old`);
  const watcher = createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old`, `${tmpDir}/new`);
  await rm(`${tmpDir}/new`, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new ISDIRMOVED_TO
${tmpDir}/new DELETEISDIR
`);
  });
  watcher.dispose();
});

test("misc - move in folder, then create file in that folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/old`);
  const watcher = createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old`, `${tmpDir}/new`);
  await writeFile(`${tmpDir}/new/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new ISDIRMOVED_TO
${tmpDir}/new/abc.txt CREATE
${tmpDir}/new/abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test.skip("move folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/old`);
  const watcher = createWatcher([tmpDir]);
  await rename(`${tmpDir}/old`, `${tmpDir}/new`);
  await writeFile(`${tmpDir}/new/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new ISDIR
${tmpDir}/.abc.txt CREATE
${tmpDir}/.abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});
