import { spawn } from "child_process";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import waitForExpect from "wait-for-expect";
import execa from "execa";

const exec = async (file, args) => {
  await execa(file, args);
};

waitForExpect.defaults.timeout = 75;

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
    result += data.toString();
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
  };
};

test("spawn", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  watcher.dispose();
});

test("create file", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
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
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt CREATE
${tmpDir}/a/abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("create file - multiple", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/1.txt`, "");
  await writeFile(`${tmpDir}/2.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1.txt CREATE
${tmpDir}/1.txt CLOSE_WRITE
${tmpDir}/2.txt CREATE
${tmpDir}/2.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("modify file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/abc.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/abc.txt`, "abc");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt MODIFY
${tmpDir}/abc.txt MODIFY
${tmpDir}/abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("modify file - nested", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  await writeFile(`${tmpDir}/a/abc.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt MODIFY
${tmpDir}/a/abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("copy file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/1.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await copyFile(`${tmpDir}/1.txt`, `${tmpDir}/2.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/2.txt CREATE
${tmpDir}/2.txt MODIFY
${tmpDir}/2.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("remove file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/abc.txt`, "");
  const watcher = await createWatcher([tmpDir]);
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
  const watcher = await createWatcher([tmpDir]);
  await rm(`${tmpDir}/a/abc.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt DELETE
`);
  });
  watcher.dispose();
});

test("create folder", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await mkdir(`${tmpDir}/a`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a CREATEISDIR
`);
  });
  watcher.dispose();
});

test("copy folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  const watcher = await createWatcher([tmpDir]);
  await exec("cp", ["-r", `${tmpDir}/1`, `${tmpDir}/2`]);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/2 CREATEISDIR
`);
  });
  watcher.dispose();
});

// TODO this test might be flaky
test.skip("create folder - nested", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await mkdir(`${tmpDir}/a/b`, { recursive: true });
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
  const watcher = await createWatcher([tmpDir]);
  await rm(`${tmpDir}/a`, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a DELETEISDIR
`);
  });
  watcher.dispose();
});

test("remove nested folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a/b`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rm(`${tmpDir}/a/b`, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/b DELETEISDIR
`);
  });
  watcher.dispose();
});

test("remove folder - nested deeply", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rm(`${tmpDir}/1`, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout)
      .toBe(`${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1/1 DELETEISDIR
${tmpDir}/1/1/1 DELETEISDIR
${tmpDir}/1/1 DELETEISDIR
${tmpDir}/1 DELETEISDIR
`);
  });
  watcher.dispose();
});

test("misc - add and remove file", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
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
  const watcher = await createWatcher([tmpDir]);
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
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a,b,c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,b,c.txt CREATE
${tmpDir}/a,b,c.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - file with unicode", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/は`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/は CREATE
${tmpDir}/は CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - file with emoji", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/🗺️`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/🗺️ CREATE
${tmpDir}/🗺️ CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - file with newline", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
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
  const watcher = await createWatcher([tmpDir]);
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
  const watcher = await createWatcher([tmpDir]);
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
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old.txt`, `${tmpDir}/new.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new.txt MOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("move in - folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/old`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old`, `${tmpDir}/new`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

// test("move file", async () => {
//   const tmpDir = await getTmpDir();
//   await writeFile(`${tmpDir}/1.txt`, "");
//   const watcher = await createWatcher([tmpDir]);
//   await rename(`${tmpDir}/1.txt`, `${tmpDir}/2.txt`);
//   // TODO should emit rename event
//   await waitForExpect(() => {
//     expect(watcher.stdout).toBe(`${tmpDir}/1.txt MOVED_FROM
// ${tmpDir}/2.txt MOVED_TO
// `);
//   });
//   watcher.dispose();
// });

test("move - file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/old.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/old.txt`, `${tmpDir}/new.txt`);
  // TODO should emit rename event
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old.txt MOVED_FROMMOVE
${tmpDir}/new.txt MOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("move folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/old`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/old`, `${tmpDir}/new`);
  await writeFile(`${tmpDir}/new/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old ISDIRMOVED_FROMMOVE
${tmpDir}/new ISDIRMOVED_TOMOVE
${tmpDir}/new/abc.txt CREATE
${tmpDir}/new/abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("move - nested folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1/1/1/1`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await writeFile(`${tmpDir}/2/2.txt`, "");
  await writeFile(`${tmpDir}/2/1/2.txt`, "");
  await writeFile(`${tmpDir}/2/1/1/2.txt`, "");
  await writeFile(`${tmpDir}/2/1/1/1/2.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2 ISDIRMOVED_TOMOVE
${tmpDir}/2/2.txt CREATE
${tmpDir}/2/2.txt CLOSE_WRITE
${tmpDir}/2/1/2.txt CREATE
${tmpDir}/2/1/2.txt CLOSE_WRITE
${tmpDir}/2/1/1/2.txt CREATE
${tmpDir}/2/1/1/2.txt CLOSE_WRITE
${tmpDir}/2/1/1/1/2.txt CREATE
${tmpDir}/2/1/1/1/2.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - move in file, then remove file", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await writeFile(`${tmpDir2}/old.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old.txt`, `${tmpDir}/new.txt`);
  await rm(`${tmpDir}/new.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new.txt MOVED_TOMOVE
${tmpDir}/new.txt DELETE
`);
  });
  watcher.dispose();
});

test("move in folder, then remove folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/old`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old`, `${tmpDir}/new`);
  await rm(`${tmpDir}/new`, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new ISDIRMOVED_TOMOVE
${tmpDir}/new DELETEISDIR
`);
  });
  watcher.dispose();
});

test("move in folder, then create file in that folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/old`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/old`, `${tmpDir}/new`);
  await writeFile(`${tmpDir}/new/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new ISDIRMOVED_TOMOVE
${tmpDir}/new/abc.txt CREATE
${tmpDir}/new/abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("move out folder, then create file in that folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/old`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/old`, `${tmpDir2}/new`);
  await writeFile(`${tmpDir2}/new/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old ISDIRMOVED_FROMMOVE
`);
  });
  watcher.dispose();
});

test("misc - move folder in and out multiple times", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/old`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/old`, `${tmpDir2}/new`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old ISDIRMOVED_FROMMOVE
`);
  });
  await rename(`${tmpDir2}/new`, `${tmpDir}/old`);
  await writeFile(`${tmpDir}/old/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old ISDIRMOVED_FROMMOVE
${tmpDir}/old ISDIRMOVED_TOMOVE
${tmpDir}/old/abc.txt CREATE
${tmpDir}/old/abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - move folder in and out multiple times (fast)", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/old`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/old`, `${tmpDir2}/new`);
  await rename(`${tmpDir2}/new`, `${tmpDir}/old`);
  await writeFile(`${tmpDir}/old/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old ISDIRMOVED_FROMMOVE
${tmpDir}/old ISDIRMOVED_TOMOVE
${tmpDir}/old/abc.txt CREATE
${tmpDir}/old/abc.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - deeply nested folder", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  for (let i = 1; i < 20; i++) {
    const name = "/1".repeat(i);
    await mkdir(`${tmpDir}${name}`);
    await waitForExpect(() => {
      expect(watcher.stdout).toBe(`${tmpDir}${name} CREATEISDIR
`);
      watcher.clear();
    });
  }
  watcher.dispose();
});

test.skip("misc - watch deeply nested folder (fast)", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await mkdir(
    `${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1`,
    { recursive: true }
  );
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 CREATEISDIR
${tmpDir}/1/1 CREATEISDIR
${tmpDir}/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1 CREATEISDIR
`);
  });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old ISDIRMOVED_FROM
`);
  });
  watcher.dispose();
});

test("misc - setup watchers for each folder inside deeply nested folder", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const count = 17;
  await mkdir(`${tmpDir}${"/1".repeat(count)}`, { recursive: true });
  await writeFile(`${tmpDir}/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toContain(`${tmpDir}/abc.txt CREATE
`);
  });
  watcher.clear();
  for (let i = 0; i < count; i++) {
    const name = `1/`.repeat(i) + "2";
    await writeFile(`${tmpDir}/${name}`, "");
    await waitForExpect(() => {
      expect(watcher.stdout).toBe(`${tmpDir}/${name} CREATE
${tmpDir}/${name} CLOSE_WRITE
`);
    });
    watcher.clear();
  }
  watcher.dispose();
});

test("misc - change file attributes", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/1`, "");
  const watcher = await createWatcher([tmpDir]);
  await chmod(`${tmpDir}/1`, "555");
  await writeFile(`${tmpDir}/2`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/2 CREATE
${tmpDir}/2 CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("misc - remove and recreate file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/1`, "");
  const watcher = await createWatcher([tmpDir]);
  await rm(`${tmpDir}/1`);
  await writeFile(`${tmpDir}/1`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 DELETE
${tmpDir}/1 CREATE
${tmpDir}/1 CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test.skip("misc - move out folder and move it back in", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir2}/1`);
  await writeFile(`${tmpDir2}/1/a.txt`, "");
  await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
  await writeFile(`${tmpDir2}/b.txt`, "");
  // TODO should detect b.txt change
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/1 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("rename file multiple times", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/1.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1.txt`, `${tmpDir}/2.txt`);
  await rename(`${tmpDir}/2.txt`, `${tmpDir}/3.txt`);
  await rename(`${tmpDir}/3.txt`, `${tmpDir}/4.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1.txt MOVED_FROMMOVE
${tmpDir}/2.txt MOVED_TOMOVE
${tmpDir}/2.txt MOVED_FROMMOVE
${tmpDir}/3.txt MOVED_TOMOVE
${tmpDir}/3.txt MOVED_FROMMOVE
${tmpDir}/4.txt MOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("rename folder multiple times", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await rename(`${tmpDir}/2`, `${tmpDir}/3`);
  await rename(`${tmpDir}/3`, `${tmpDir}/4`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2 ISDIRMOVED_TOMOVE
${tmpDir}/2 ISDIRMOVED_FROMMOVE
${tmpDir}/3 ISDIRMOVED_TOMOVE
${tmpDir}/3 ISDIRMOVED_FROMMOVE
${tmpDir}/4 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("move in folder, move out another folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  await mkdir(`${tmpDir2}/2`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/2`, `${tmpDir}/2`);
  await rename(`${tmpDir}/1`, `${tmpDir2}/1`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/2 ISDIRMOVED_TOMOVE
${tmpDir}/1 ISDIRMOVED_FROMMOVE
`);
  });
  watcher.dispose();
});

test("move out folder, move in another folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  await mkdir(`${tmpDir2}/2`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir2}/1`);
  await rename(`${tmpDir2}/2`, `${tmpDir}/2`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("nested rename", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1/2/3/4/5`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1/2/3/4/5`, `${tmpDir}/1/6`);
  await rename(`${tmpDir}/1/2/3`, `${tmpDir}/1/6/3`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1/2/3/4/5 ISDIRMOVED_FROMMOVE
${tmpDir}/1/6 ISDIRMOVED_TOMOVE
${tmpDir}/1/2/3 ISDIRMOVED_FROMMOVE
${tmpDir}/1/6/3 ISDIRMOVED_TOMOVE
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/a.txt`, "");
  await writeFile(`${tmpDir}/1/b.txt`, "");
  await writeFile(`${tmpDir}/1/2/c.txt`, "");
  await writeFile(`${tmpDir}/1/6/d.txt`, "");
  await writeFile(`${tmpDir}/1/6/3/e.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a.txt CREATE
${tmpDir}/a.txt CLOSE_WRITE
${tmpDir}/1/b.txt CREATE
${tmpDir}/1/b.txt CLOSE_WRITE
${tmpDir}/1/2/c.txt CREATE
${tmpDir}/1/2/c.txt CLOSE_WRITE
${tmpDir}/1/6/d.txt CREATE
${tmpDir}/1/6/d.txt CLOSE_WRITE
${tmpDir}/1/6/3/e.txt CREATE
${tmpDir}/1/6/3/e.txt CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("rename subtree", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1/2/3/4/5/6/7/8/9`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1/2/3/4/5`, `${tmpDir}/1/5`);
  await writeFile(`${tmpDir}/1/5/6/7/a.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1/2/3/4/5 ISDIRMOVED_FROMMOVE
${tmpDir}/1/5 ISDIRMOVED_TOMOVE
${tmpDir}/1/5/a.txt CREATE
`);
  });
  watcher.dispose();
});

// TODO test nested rename   const tmpDir = await getTmpDir();
// // const tmpDir2 = await getTmpDir();
// await mkdir(`${tmpDir}/1`);
// await mkdir(`${tmpDir}/2`);
// await writeFile(`${tmpDir}/1/a.txt`, "");
// // await rename(`${tmpDir}/1`, `${tmpDir}/2`);
// const watcher = await createWatcher([tmpDir]);
// await rename(`${tmpDir}/1/a.txt`, `${tmpDir}/2/b.txt`);

test("move out and move folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  await mkdir(`${tmpDir2}/2`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir2}/1`);
  await rename(`${tmpDir2}/1`, `${tmpDir2}/2`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_FROMMOVE
`);
  });
  watcher.dispose();
});

test("move and move out folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  await mkdir(`${tmpDir2}/2`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await rename(`${tmpDir}/2`, `${tmpDir2}/2`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2 ISDIRMOVED_TOMOVE
${tmpDir}/2 ISDIRMOVED_FROMMOVE
`);
  });
  watcher.dispose();
});

test("move and move in folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  await mkdir(`${tmpDir2}/3`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await rename(`${tmpDir2}/3`, `${tmpDir}/3`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2 ISDIRMOVED_TOMOVE
${tmpDir}/3 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("move in and move folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/1`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_TOMOVE
${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

// TODO test move, move-in, move-out with nested folder

// TODO test no memory leak when final event is moved_from

test("rename short path to long path", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  const watcher = await createWatcher([tmpDir]);
  await rename(
    `${tmpDir}/1`,
    `${tmpDir}/22222222222222222222222222222222222222222222222222222222222222222222222222`
  );
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/22222222222222222222222222222222222222222222222222222222222222222222222222 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("rename long path to short path", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(
    `${tmpDir}/22222222222222222222222222222222222222222222222222222222222222222222222222`
  );
  const watcher = await createWatcher([tmpDir]);
  await rename(
    `${tmpDir}/22222222222222222222222222222222222222222222222222222222222222222222222222`,
    `${tmpDir}/1`
  );
  await waitForExpect(() => {
    expect(watcher.stdout)
      .toBe(`${tmpDir}/22222222222222222222222222222222222222222222222222222222222222222222222222 ISDIRMOVED_FROMMOVE
${tmpDir}/1 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

// TODO test moved_from and separate moved_to

// TODO test moved_from folder and moved_to file

// TODO test moved_from file and moved_to folder

test("renaming folders from top 1/1/1 -> -> 2/1/1 -> 2/3/1 -> 2/3/4", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1/1/1`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await rename(`${tmpDir}/2/1`, `${tmpDir}/2/3`);
  await rename(`${tmpDir}/2/3/1`, `${tmpDir}/2/3/4`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2 ISDIRMOVED_TOMOVE
${tmpDir}/2/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2/3 ISDIRMOVED_TOMOVE
${tmpDir}/2/3/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2/3/4 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("renaming folders from bottom 1/1/1 -> 1/1/4 -> 1/3/4 -> 2/3/4", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1/1/1`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1/1/1`, `${tmpDir}/1/1/4`);
  await rename(`${tmpDir}/1/1`, `${tmpDir}/1/3`);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1/1/1 ISDIRMOVED_FROMMOVE
${tmpDir}/1/1/4 ISDIRMOVED_TOMOVE
${tmpDir}/1/1 ISDIRMOVED_FROMMOVE
${tmpDir}/1/3 ISDIRMOVED_TOMOVE
${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

test("renaming folders from middle 1/1/1 -> 1/3/1 -> 2/3/1 -> 2/3/4", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1/1/1`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1/1`, `${tmpDir}/1/3`);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await rename(`${tmpDir}/2/3/1`, `${tmpDir}/2/3/4`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1/1 ISDIRMOVED_FROMMOVE
${tmpDir}/1/3 ISDIRMOVED_TOMOVE
${tmpDir}/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2 ISDIRMOVED_TOMOVE
${tmpDir}/2/3/1 ISDIRMOVED_FROMMOVE
${tmpDir}/2/3/4 ISDIRMOVED_TOMOVE
`);
  });
  watcher.dispose();
});

// TODO test move in folder then create folder inside that folder, remove outer folder and create file in inner folder

// TODO test remove lowest wd

// TODO test remove highest wd

// TODO this results in bug -> investigate
// const tmpDir = await getTmpDir();
// const tmpDir2 = await getTmpDir();
// await mkdir(`${tmpDir}/old`);
// const watcher = await createWatcher([tmpDir]);
// await rename(`${tmpDir}/old`, `${tmpDir2}/new`);
// await setTimeout(100);
// await rename(`${tmpDir2}/new`, `${tmpDir}/old`);
// await writeFile(`${tmpDir}/old/abc.txt`, "");
