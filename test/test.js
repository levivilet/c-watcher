import { spawn } from "child_process";
import csv from "csv-parser";
import execa from "execa";
import {
  appendFile,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import waitForExpect from "wait-for-expect";

const exec = async (file, args) => {
  await execa(file, args);
};

const getTmpDir = () => {
  return mkdtemp(join(tmpdir(), "foo-"));
};

/**
 *
 * @param {readonly string[]} args
 * @returns
 */
const createWatcher = async (args = []) => {
  const child = spawn("./hello", args);
  let result = "";
  let status = "normal";
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

  child.on("exit", (code) => {
    if (code == 1) {
      throw new Error("exit code 1");
    }
    status = "exited";
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
    get status() {
      return status;
    },
  };
};

/**
 *
 * @param {readonly string[]} args
 */
const createCliWatcher = async (args = []) => {
  const child = spawn("./hello", args);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data) => {
    stdout += data.toString();
  });
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  return {
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    dispose() {
      child.kill();
    },
    clear() {
      stdout = "";
    },
  };
};

/**
 *
 * @param {readonly string[]} args
 * @returns
 */
const createCsvWatcher = async (args = []) => {
  const child = spawn("./hello", args);
  const result = [];
  child.stdout
    .pipe(
      csv({
        headers: ["path", "operation"],
      })
    )
    .on("data", (data) => {
      result.push(data);
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
  };
};

beforeAll(() => {
  waitForExpect.defaults.timeout = 101;
});

afterAll(async () => {
  await exec(`rm`, ["-rf", "/tmp/foo*"]);
});

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
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt,CREATE
${tmpDir}/abc.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt,CREATE
${tmpDir}/a/abc.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/1.txt,CREATE
${tmpDir}/1.txt,CLOSE_WRITE
${tmpDir}/2.txt,CREATE
${tmpDir}/2.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("modify file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/abc.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await appendFile(`${tmpDir}/abc.txt`, "abc");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt,MODIFY
${tmpDir}/abc.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt,MODIFY
${tmpDir}/a/abc.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/2.txt,CREATE
${tmpDir}/2.txt,MODIFY
${tmpDir}/2.txt,ATTRIB
${tmpDir}/2.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt,DELETE
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
    expect(watcher.stdout).toBe(`${tmpDir}/a/abc.txt,DELETE
`);
  });
  watcher.dispose();
});

test("create folder", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await mkdir(`${tmpDir}/a`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,CREATE_DIR
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
    expect(watcher.stdout).toContain(`${tmpDir}/2,CREATE_DIR`);
  });
  watcher.dispose();
});

test("remove folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  const watcher = await createWatcher([tmpDir]);
  await rm(`${tmpDir}/a`, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,DELETE_DIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/a/b,DELETE_DIR
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
      .toBe(`${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1/1,DELETE_DIR
${tmpDir}/1/1/1,DELETE_DIR
${tmpDir}/1/1,DELETE_DIR
${tmpDir}/1,DELETE_DIR
`);
  });
  watcher.dispose();
});

test("add and remove file", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/abc.txt`, "");
  await rm(`${tmpDir}/abc.txt`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/abc.txt,CREATE
${tmpDir}/abc.txt,CLOSE_WRITE
${tmpDir}/abc.txt,DELETE
`);
  });
  watcher.dispose();
});

test("file with spaces", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a b c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`"${tmpDir}/a b c.txt",CREATE
"${tmpDir}/a b c.txt",CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("csvWatcher: file with spaces", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createCsvWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a b c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toEqual([
      {
        operation: "CREATE",
        path: `${tmpDir}/a b c.txt`,
      },
      {
        operation: "CLOSE_WRITE",
        path: `${tmpDir}/a b c.txt`,
      },
    ]);
  });
  watcher.dispose();
});

test("file with comma", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a,b,c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`"${tmpDir}/a,b,c.txt",CREATE
"${tmpDir}/a,b,c.txt",CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("csvWatcher: file with comma", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createCsvWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a,b,c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toEqual([
      {
        operation: "CREATE",
        path: `${tmpDir}/a,b,c.txt`,
      },
      {
        operation: "CLOSE_WRITE",
        path: `${tmpDir}/a,b,c.txt`,
      },
    ]);
  });
  watcher.dispose();
});

test("file with unicode", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/は`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/は,CREATE
${tmpDir}/は,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("file with emoji", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/🗺️`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/🗺️,CREATE
${tmpDir}/🗺️,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("csvWatcher: file with emoji", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createCsvWatcher([tmpDir]);
  await writeFile(`${tmpDir}/🗺️`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toEqual([
      {
        operation: "CREATE",
        path: `${tmpDir}/🗺️`,
      },
      {
        operation: "CLOSE_WRITE",
        path: `${tmpDir}/🗺️`,
      },
    ]);
  });
  watcher.dispose();
});

test("folder with greek letters", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await mkdir(`${tmpDir}/Σ Τ Υ Φ Χ Ψ`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`"${tmpDir}/Σ Τ Υ Φ Χ Ψ",CREATE_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/Σ Τ Υ Φ Χ Ψ/1.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`"${tmpDir}/Σ Τ Υ Φ Χ Ψ/1.txt",CREATE
"${tmpDir}/Σ Τ Υ Φ Χ Ψ/1.txt",CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("file with newline", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a\nb\nc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`"${tmpDir}/a\nb\nc.txt",CREATE
"${tmpDir}/a\nb\nc.txt",CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("csvWatcher: file with newline", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createCsvWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a\nb\nc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toEqual([
      {
        operation: "CREATE",
        path: `${tmpDir}/a\nb\nc.txt`,
      },
      {
        operation: "CLOSE_WRITE",
        path: `${tmpDir}/a\nb\nc.txt`,
      },
    ]);
  });
  watcher.dispose();
});

test("file with quotes", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a"b"c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`"${tmpDir}/a""b""c.txt",CREATE
"${tmpDir}/a""b""c.txt",CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("csvWatcher: file with quotes", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createCsvWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a"b"c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toEqual([
      {
        operation: "CREATE",
        path: `${tmpDir}/a"b"c.txt`,
      },
      {
        operation: "CLOSE_WRITE",
        path: `${tmpDir}/a"b"c.txt`,
      },
    ]);
  });
  watcher.dispose();
});

test("file with dot at start", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/.abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/.abc.txt,CREATE
${tmpDir}/.abc.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/new.txt,MOVED_TO
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
    expect(watcher.stdout).toBe(`${tmpDir}/new,MOVED_TO_DIR
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
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old.txt,MOVED_FROM
${tmpDir}/new.txt,MOVED_TO
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
    expect(watcher.stdout).toBe(`${tmpDir}/old,MOVED_FROM_DIR
${tmpDir}/new,MOVED_TO_DIR
${tmpDir}/new/abc.txt,CREATE
${tmpDir}/new/abc.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2,MOVED_TO_DIR
${tmpDir}/2/2.txt,CREATE
${tmpDir}/2/2.txt,CLOSE_WRITE
${tmpDir}/2/1/2.txt,CREATE
${tmpDir}/2/1/2.txt,CLOSE_WRITE
${tmpDir}/2/1/1/2.txt,CREATE
${tmpDir}/2/1/1/2.txt,CLOSE_WRITE
${tmpDir}/2/1/1/1/2.txt,CREATE
${tmpDir}/2/1/1/1/2.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/new.txt,MOVED_TO
${tmpDir}/new.txt,DELETE
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
    expect(watcher.stdout).toBe(`${tmpDir}/new,MOVED_TO_DIR
${tmpDir}/new,DELETE_DIR
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
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/new/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/new/abc.txt,CREATE
${tmpDir}/new/abc.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/old,MOVED_FROM_DIR
`);
  });
  watcher.dispose();
});

test("move folder in and out multiple times", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/old`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/old`, `${tmpDir2}/new`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old,MOVED_FROM_DIR
`);
  });
  watcher.clear();
  await rename(`${tmpDir2}/new`, `${tmpDir}/old`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/old/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old/abc.txt,CREATE
${tmpDir}/old/abc.txt,CLOSE_WRITE
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
      expect(watcher.stdout).toBe(`${tmpDir}${name},CREATE_DIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/1,CREATE_DIR
${tmpDir}/1/1,CREATE_DIR
${tmpDir}/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
${tmpDir}/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1/1,CREATE_DIR
`);
  });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/old,MOVED_FROM_DIR
`);
  });
  watcher.dispose();
});

test("setup watchers for each folder inside deeply nested folder", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const count = 17;
  await mkdir(`${tmpDir}${"/1".repeat(count)}`, { recursive: true });
  await writeFile(`${tmpDir}/abc.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toContain(`${tmpDir}/abc.txt,CREATE
`);
  });
  watcher.clear();
  for (let i = 0; i < count; i++) {
    const name = `1/`.repeat(i) + "2";
    await writeFile(`${tmpDir}/${name}`, "");
    await waitForExpect(() => {
      expect(watcher.stdout).toBe(`${tmpDir}/${name},CREATE
${tmpDir}/${name},CLOSE_WRITE
`);
    });
    watcher.clear();
  }
  watcher.dispose();
});

test("change file attributes", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/1`, "");
  const watcher = await createWatcher([tmpDir]);
  await chmod(`${tmpDir}/1`, "555");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,ATTRIB
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
    expect(watcher.stdout).toBe(`${tmpDir}/1,DELETE
${tmpDir}/1,CREATE
${tmpDir}/1,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("move out folder and move it back in", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir2}/1`);
  await writeFile(`${tmpDir2}/1/a.txt`, "");
  await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
  await writeFile(`${tmpDir}/b.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/1,MOVED_TO_DIR
${tmpDir}/b.txt,CREATE
${tmpDir}/b.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/1.txt,MOVED_FROM
${tmpDir}/2.txt,MOVED_TO
${tmpDir}/2.txt,MOVED_FROM
${tmpDir}/3.txt,MOVED_TO
${tmpDir}/3.txt,MOVED_FROM
${tmpDir}/4.txt,MOVED_TO
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
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2,MOVED_TO_DIR
${tmpDir}/2,MOVED_FROM_DIR
${tmpDir}/3,MOVED_TO_DIR
${tmpDir}/3,MOVED_FROM_DIR
${tmpDir}/4,MOVED_TO_DIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/2,MOVED_TO_DIR
${tmpDir}/1,MOVED_FROM_DIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2,MOVED_TO_DIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/1/2/3/4/5,MOVED_FROM_DIR
${tmpDir}/1/6,MOVED_TO_DIR
${tmpDir}/1/2/3,MOVED_FROM_DIR
${tmpDir}/1/6/3,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/a.txt`, "");
  await writeFile(`${tmpDir}/1/b.txt`, "");
  await writeFile(`${tmpDir}/1/2/c.txt`, "");
  await writeFile(`${tmpDir}/1/6/d.txt`, "");
  await writeFile(`${tmpDir}/1/6/3/e.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a.txt,CREATE
${tmpDir}/a.txt,CLOSE_WRITE
${tmpDir}/1/b.txt,CREATE
${tmpDir}/1/b.txt,CLOSE_WRITE
${tmpDir}/1/2/c.txt,CREATE
${tmpDir}/1/2/c.txt,CLOSE_WRITE
${tmpDir}/1/6/d.txt,CREATE
${tmpDir}/1/6/d.txt,CLOSE_WRITE
${tmpDir}/1/6/3/e.txt,CREATE
${tmpDir}/1/6/3/e.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/1/2/3/4/5,MOVED_FROM_DIR
${tmpDir}/1/5,MOVED_TO_DIR
${tmpDir}/1/5/6/7/a.txt,CREATE
${tmpDir}/1/5/6/7/a.txt,CLOSE_WRITE
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
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2,MOVED_TO_DIR
${tmpDir}/2,MOVED_FROM_DIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2,MOVED_TO_DIR
${tmpDir}/3,MOVED_TO_DIR
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
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2,MOVED_TO_DIR
`);
  });
  watcher.dispose();
});

test("move in nested folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/1/2/3/4/5/6/7/8/9`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/1/2/3/4/5/6/7/8/9/new.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1/2/3/4/5/6/7/8/9/new.txt,CREATE
${tmpDir}/1/2/3/4/5/6/7/8/9/new.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test.skip("folder move race condition", async () => {
  waitForExpect.defaults.timeout = 100;
  // this tests a very specific bug when a folder is moved in
  // it can happen that the watch for is not yet established
  // and the folder is renamed. When the renamed folder is renamed again
  // since there has been no watcher, the path is not in storage and
  // the full path for the event is not known (which is very unusual).
  // Usually the watcher would be removed but since it is not in storage
  // there is no watcher to remove.
  for (let i = 0; i < 100; i++) {
    const tmpDir = await getTmpDir();
    const tmpDir2 = await getTmpDir();
    await mkdir(`${tmpDir2}/1`);
    const watcher = await createWatcher([tmpDir]);
    await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
    await waitForExpect(() => {
      expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_TO_DIR
`);
    });
    watcher.clear();
    await rename(`${tmpDir}/1`, `${tmpDir}/3`);
    await rename(`${tmpDir}/3`, `${tmpDir2}/4`);
    await writeFile(`${tmpDir2}/4/a.txt`, ``);
    await waitForExpect(() => {
      expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/3,MOVED_TO_DIR
${tmpDir}/3,MOVED_FROM_DIR
`);
    });
    watcher.dispose();
  }
}, 10_000);

// TODO bug
// for (let i = 0; i < 100; i++) {
//   const tmpDir = await getTmpDir();
//   const tmpDir2 = await getTmpDir();
//   await mkdir(`${tmpDir2}/1`);
//   const watcher = await createWatcher([tmpDir]);
//   await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
//   await rename(`${tmpDir}/1`, `${tmpDir}/3`);
//   await rename(`${tmpDir}/3`, `${tmpDir2}/4`);
//   await writeFile(`${tmpDir2}/4/a.txt`, ``);
//   await waitForExpect(() => {
//     expect(watcher.stdout).toBe(`${tmpDir}/1 ISDIR,MOVED_TO
// ${tmpDir}/1 ISDIR,MOVED_FROM
// ${tmpDir}/3 ISDIR,MOVED_TO
// ${tmpDir}/3 ISDIR,MOVED_FROM
// `);
//   });
//   watcher.dispose();
// }

test("rename short path to long path", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  const watcher = await createWatcher([tmpDir]);
  await rename(
    `${tmpDir}/1`,
    `${tmpDir}/22222222222222222222222222222222222222222222222222222222222222222222222222`
  );
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/22222222222222222222222222222222222222222222222222222222222222222222222222,MOVED_TO_DIR
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
      .toBe(`${tmpDir}/22222222222222222222222222222222222222222222222222222222222222222222222222,MOVED_FROM_DIR
${tmpDir}/1,MOVED_TO_DIR
`);
  });
  watcher.dispose();
});

test("renaming folders from top 1/1/1 -> -> 2/1/1 -> 2/3/1 -> 2/3/4", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1/1/1`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir}/2`);
  await rename(`${tmpDir}/2/1`, `${tmpDir}/2/3`);
  await rename(`${tmpDir}/2/3/1`, `${tmpDir}/2/3/4`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2,MOVED_TO_DIR
${tmpDir}/2/1,MOVED_FROM_DIR
${tmpDir}/2/3,MOVED_TO_DIR
${tmpDir}/2/3/1,MOVED_FROM_DIR
${tmpDir}/2/3/4,MOVED_TO_DIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/1/1/1,MOVED_FROM_DIR
${tmpDir}/1/1/4,MOVED_TO_DIR
${tmpDir}/1/1,MOVED_FROM_DIR
${tmpDir}/1/3,MOVED_TO_DIR
${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2,MOVED_TO_DIR
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
    expect(watcher.stdout).toBe(`${tmpDir}/1/1,MOVED_FROM_DIR
${tmpDir}/1/3,MOVED_TO_DIR
${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2,MOVED_TO_DIR
${tmpDir}/2/3/1,MOVED_FROM_DIR
${tmpDir}/2/3/4,MOVED_TO_DIR
`);
  });
  watcher.dispose();
});

test("move out child folder, remove parent folder, move child folder back in", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1/2`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1/2`, `${tmpDir2}/2`);
  await rm(`${tmpDir}/1`, { recursive: true });
  await rename(`${tmpDir2}/2`, `${tmpDir}/2`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1/2,MOVED_FROM_DIR
${tmpDir}/1,DELETE_DIR
${tmpDir}/2,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/2/a.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/2/a.txt,CREATE
${tmpDir}/2/a.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("replace file with folder", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/1`, "");
  const watcher = await createWatcher([tmpDir]);
  await rm(`${tmpDir}/1`);
  await mkdir(`${tmpDir}/1`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,DELETE
${tmpDir}/1,CREATE_DIR
`);
  });
  watcher.dispose();
});

test("replace folder with file", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  const watcher = await createWatcher([tmpDir]);
  await rm(`${tmpDir}/1`, { recursive: true });
  await writeFile(`${tmpDir}/1`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,DELETE_DIR
${tmpDir}/1,CREATE
${tmpDir}/1,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("create multiple files in parallel", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await Promise.all([
    writeFile(`${tmpDir}/1`, ""),
    writeFile(`${tmpDir}/2`, ""),
    writeFile(`${tmpDir}/3`, ""),
  ]);
  await waitForExpect(() => {
    expect(watcher.stdout).toContain(`${tmpDir}/1,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/1,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/2,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/2,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/3,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/3,CLOSE_WRITE`);
  });
  watcher.dispose();
});

test("remove multiple files in parallel", async () => {
  const tmpDir = await getTmpDir();
  await Promise.all([
    writeFile(`${tmpDir}/1`, ""),
    writeFile(`${tmpDir}/2`, ""),
    writeFile(`${tmpDir}/3`, ""),
  ]);
  const watcher = await createWatcher([tmpDir]);
  await Promise.all([rm(`${tmpDir}/1`), rm(`${tmpDir}/2`), rm(`${tmpDir}/3`)]);
  await waitForExpect(() => {
    expect(watcher.stdout).toContain(`${tmpDir}/1,DELETE`);
    expect(watcher.stdout).toContain(`${tmpDir}/2,DELETE`);
    expect(watcher.stdout).toContain(`${tmpDir}/3,DELETE`);
  });
  watcher.dispose();
});

test("move out multiple files in parallel", async () => {
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
  await waitForExpect(() => {
    expect(watcher.stdout).toContain(`${tmpDir}/1,MOVED_FROM`);
    expect(watcher.stdout).toContain(`${tmpDir}/2,MOVED_FROM`);
    expect(watcher.stdout).toContain(`${tmpDir}/3,MOVED_FROM`);
  });
  watcher.dispose();
});

test("move out some files and folders", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  await mkdir(`${tmpDir}/2`);
  await writeFile(`${tmpDir}/2/3.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir2}/1`);
  await rename(`${tmpDir}/2/3.txt`, `${tmpDir2}/3.txt`);
  await rename(`${tmpDir}/2`, `${tmpDir2}/2`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
${tmpDir}/2/3.txt,MOVED_FROM
${tmpDir}/2,MOVED_FROM_DIR
`);
  });
  watcher.dispose();
});

test("move out many folders", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  for (let i = 0; i < 100; i++) {
    await mkdir(`${tmpDir}/${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.stdout.split("\n").length).toBe(101);
  });
  for (let i = 0; i < 100; i++) {
    await rename(`${tmpDir}/${i}`, `${tmpDir2}/${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.stdout).toContain(`${tmpDir}/1,MOVED_FROM_DIR`);
    expect(watcher.stdout).toContain(`${tmpDir}/99,MOVED_FROM_DIR`);
  });
  watcher.dispose();
});

test("create nine files in one directory", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await Promise.all([
    writeFile(`${tmpDir}/0`, ""),
    writeFile(`${tmpDir}/1`, ""),
    writeFile(`${tmpDir}/2`, ""),
    writeFile(`${tmpDir}/3`, ""),
    writeFile(`${tmpDir}/4`, ""),
  ]);
  await Promise.all([
    writeFile(`${tmpDir}/5`, ""),
    writeFile(`${tmpDir}/6`, ""),
  ]);
  await Promise.all([
    writeFile(`${tmpDir}/7`, ""),
    writeFile(`${tmpDir}/8`, ""),
  ]);
  await writeFile(`${tmpDir}/9`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toContain(`${tmpDir}/1,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/1,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/2,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/3,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/3,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/3,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/4,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/4,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/5,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/5,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/6,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/6,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/7,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/7,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/8,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/8,CLOSE_WRITE`);
    expect(watcher.stdout).toContain(`${tmpDir}/9,CREATE`);
    expect(watcher.stdout).toContain(`${tmpDir}/9,CLOSE_WRITE`);
  });
  watcher.dispose();
});

test("create thirtythree files in nine folders", async () => {
  const tmpDir = await getTmpDir();
  const test1Path = `${tmpDir}/add1.txt`;
  const testb1Path = `${tmpDir}/b/add1.txt`;
  const testc1Path = `${tmpDir}/c/add1.txt`;
  const testd1Path = `${tmpDir}/d/add1.txt`;
  const teste1Path = `${tmpDir}/e/add1.txt`;
  const testf1Path = `${tmpDir}/f/add1.txt`;
  const testg1Path = `${tmpDir}/g/add1.txt`;
  const testh1Path = `${tmpDir}/h/add1.txt`;
  const testi1Path = `${tmpDir}/i/add1.txt`;
  const test2Path = `${tmpDir}/add2.txt`;
  const testb2Path = `${tmpDir}/b/add2.txt`;
  const testc2Path = `${tmpDir}/c/add2.txt`;
  const test3Path = `${tmpDir}/add3.txt`;
  const testb3Path = `${tmpDir}/b/add3.txt`;
  const testc3Path = `${tmpDir}/c/add3.txt`;
  const test4Path = `${tmpDir}/add4.txt`;
  const testb4Path = `${tmpDir}/b/add4.txt`;
  const testc4Path = `${tmpDir}/c/add4.txt`;
  const test5Path = `${tmpDir}/add5.txt`;
  const testb5Path = `${tmpDir}/b/add5.txt`;
  const testc5Path = `${tmpDir}/c/add5.txt`;
  const test6Path = `${tmpDir}/add6.txt`;
  const testb6Path = `${tmpDir}/b/add6.txt`;
  const testc6Path = `${tmpDir}/c/add6.txt`;
  const test7Path = `${tmpDir}/add7.txt`;
  const testb7Path = `${tmpDir}/b/add7.txt`;
  const testc7Path = `${tmpDir}/c/add7.txt`;
  const test8Path = `${tmpDir}/add8.txt`;
  const testb8Path = `${tmpDir}/b/add8.txt`;
  const testc8Path = `${tmpDir}/c/add8.txt`;
  const test9Path = `${tmpDir}/add9.txt`;
  const testb9Path = `${tmpDir}/b/add9.txt`;
  const testc9Path = `${tmpDir}/c/add9.txt`;
  await Promise.all([
    mkdir(`${tmpDir}/b`),
    mkdir(`${tmpDir}/c`),
    mkdir(`${tmpDir}/d`),
    mkdir(`${tmpDir}/e`),
    mkdir(`${tmpDir}/f`),
    mkdir(`${tmpDir}/g`),
    mkdir(`${tmpDir}/h`),
    mkdir(`${tmpDir}/i`),
  ]);
  const watcher = await createWatcher([tmpDir]);
  await writeFile(test1Path, "");
  await writeFile(test2Path, "");
  await writeFile(test3Path, "");
  await writeFile(test4Path, "");
  await writeFile(test5Path, "");
  await writeFile(test6Path, "");
  await writeFile(test7Path, "");
  await writeFile(test8Path, "");
  await writeFile(test9Path, "");
  await writeFile(testb1Path, "");
  await writeFile(testb2Path, "");
  await writeFile(testb3Path, "");
  await writeFile(testb4Path, "");
  await writeFile(testb5Path, "");
  await writeFile(testb6Path, "");
  await writeFile(testb7Path, "");
  await writeFile(testb8Path, "");
  await writeFile(testb9Path, "");
  await writeFile(testc1Path, "");
  await writeFile(testc2Path, "");
  await writeFile(testc3Path, "");
  await writeFile(testc4Path, "");
  await writeFile(testc5Path, "");
  await writeFile(testc6Path, "");
  await writeFile(testc7Path, "");
  await writeFile(testc8Path, "");
  await writeFile(testc9Path, "");
  await writeFile(testd1Path, "");
  await writeFile(teste1Path, "");
  await writeFile(testf1Path, "");
  await writeFile(testg1Path, "");
  await writeFile(testh1Path, "");
  await writeFile(testi1Path, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/add1.txt,CREATE
${tmpDir}/add1.txt,CLOSE_WRITE
${tmpDir}/add2.txt,CREATE
${tmpDir}/add2.txt,CLOSE_WRITE
${tmpDir}/add3.txt,CREATE
${tmpDir}/add3.txt,CLOSE_WRITE
${tmpDir}/add4.txt,CREATE
${tmpDir}/add4.txt,CLOSE_WRITE
${tmpDir}/add5.txt,CREATE
${tmpDir}/add5.txt,CLOSE_WRITE
${tmpDir}/add6.txt,CREATE
${tmpDir}/add6.txt,CLOSE_WRITE
${tmpDir}/add7.txt,CREATE
${tmpDir}/add7.txt,CLOSE_WRITE
${tmpDir}/add8.txt,CREATE
${tmpDir}/add8.txt,CLOSE_WRITE
${tmpDir}/add9.txt,CREATE
${tmpDir}/add9.txt,CLOSE_WRITE
${tmpDir}/b/add1.txt,CREATE
${tmpDir}/b/add1.txt,CLOSE_WRITE
${tmpDir}/b/add2.txt,CREATE
${tmpDir}/b/add2.txt,CLOSE_WRITE
${tmpDir}/b/add3.txt,CREATE
${tmpDir}/b/add3.txt,CLOSE_WRITE
${tmpDir}/b/add4.txt,CREATE
${tmpDir}/b/add4.txt,CLOSE_WRITE
${tmpDir}/b/add5.txt,CREATE
${tmpDir}/b/add5.txt,CLOSE_WRITE
${tmpDir}/b/add6.txt,CREATE
${tmpDir}/b/add6.txt,CLOSE_WRITE
${tmpDir}/b/add7.txt,CREATE
${tmpDir}/b/add7.txt,CLOSE_WRITE
${tmpDir}/b/add8.txt,CREATE
${tmpDir}/b/add8.txt,CLOSE_WRITE
${tmpDir}/b/add9.txt,CREATE
${tmpDir}/b/add9.txt,CLOSE_WRITE
${tmpDir}/c/add1.txt,CREATE
${tmpDir}/c/add1.txt,CLOSE_WRITE
${tmpDir}/c/add2.txt,CREATE
${tmpDir}/c/add2.txt,CLOSE_WRITE
${tmpDir}/c/add3.txt,CREATE
${tmpDir}/c/add3.txt,CLOSE_WRITE
${tmpDir}/c/add4.txt,CREATE
${tmpDir}/c/add4.txt,CLOSE_WRITE
${tmpDir}/c/add5.txt,CREATE
${tmpDir}/c/add5.txt,CLOSE_WRITE
${tmpDir}/c/add6.txt,CREATE
${tmpDir}/c/add6.txt,CLOSE_WRITE
${tmpDir}/c/add7.txt,CREATE
${tmpDir}/c/add7.txt,CLOSE_WRITE
${tmpDir}/c/add8.txt,CREATE
${tmpDir}/c/add8.txt,CLOSE_WRITE
${tmpDir}/c/add9.txt,CREATE
${tmpDir}/c/add9.txt,CLOSE_WRITE
${tmpDir}/d/add1.txt,CREATE
${tmpDir}/d/add1.txt,CLOSE_WRITE
${tmpDir}/e/add1.txt,CREATE
${tmpDir}/e/add1.txt,CLOSE_WRITE
${tmpDir}/f/add1.txt,CREATE
${tmpDir}/f/add1.txt,CLOSE_WRITE
${tmpDir}/g/add1.txt,CREATE
${tmpDir}/g/add1.txt,CLOSE_WRITE
${tmpDir}/h/add1.txt,CREATE
${tmpDir}/h/add1.txt,CLOSE_WRITE
${tmpDir}/i/add1.txt,CREATE
${tmpDir}/i/add1.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("remove and recreate file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/1.txt`, "");
  const watcher = await createWatcher([tmpDir]);
  await rm(`${tmpDir}/1.txt`);
  await writeFile(`${tmpDir}/1.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1.txt,DELETE
${tmpDir}/1.txt,CREATE
${tmpDir}/1.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("move in folder, then create folder inside that folder, remove outer folder and create file in inner folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/1`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir2}/1`, `${tmpDir}/1`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_TO_DIR
`);
  });
  watcher.clear();
  // TODO test with fast creation of nested folder 1/2/3/4/5/6/7/8/9/10/11/12
  await mkdir(`${tmpDir}/1/2`);
  await rename(`${tmpDir}/1`, `${tmpDir2}/1`);
  await writeFile(`${tmpDir2}/1/2/3.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1/2,CREATE_DIR
${tmpDir}/1,MOVED_FROM_DIR
`);
  });
  watcher.dispose();
});

test("create and remove deeply nested folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/1`);
  const watcher = await createWatcher([tmpDir]);
  await mkdir(`${tmpDir}/1/1/1/1/1/1`, { recursive: true });
  await rm(`${tmpDir}/1`, { recursive: true });
  await writeFile(`${tmpDir}/2.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toContain(`${tmpDir}/1/1,CREATE_DIR`);
    expect(watcher.stdout).toContain(`${tmpDir}/1,DELETE_DIR`);
    expect(watcher.stdout).toContain(`${tmpDir}/2.txt,CREATE`);
  });
  watcher.dispose();
});

test("inner watcher should be removed when parent folder is moved out", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/1/2`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/1`, `${tmpDir2}/1`);
  await writeFile(`${tmpDir2}/1/2/3.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/1,MOVED_FROM_DIR
`);
  });
  watcher.dispose();
});

test("rename deeply nested folder (https://github.com/inotify-tools/inotify-tools/issues/130)", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a1/a2/a3/a4/a5/a6/a7/a8/a9`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/a1`, `${tmpDir}/b1`);
  await writeFile(`${tmpDir}/b1/a2/a3/a4/a5/a6/a7/a8/a9/new.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a1,MOVED_FROM_DIR
${tmpDir}/b1,MOVED_TO_DIR
${tmpDir}/b1/a2/a3/a4/a5/a6/a7/a8/a9/new.txt,CREATE
${tmpDir}/b1/a2/a3/a4/a5/a6/a7/a8/a9/new.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("move some files around (https://github.com/inotify-tools/inotify-tools/issues/137)", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/to_move/dir`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/to_move/dir/test_file.txt`, "");
  await rename(`${tmpDir}/to_move`, `${tmpDir2}/to_move`);
  await writeFile(`${tmpDir2}/to_move/dir/test_file.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/to_move/dir/test_file.txt,CREATE
${tmpDir}/to_move/dir/test_file.txt,CLOSE_WRITE
${tmpDir}/to_move,MOVED_FROM_DIR
`);
  });
  watcher.dispose();
});

test("move and delete some folders (https://github.com/Axosoft/nsfw/pull/63)", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a/b`, { recursive: true });
  await mkdir(`${tmpDir}/a/c`, { recursive: true });
  await mkdir(`${tmpDir}/d`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/a/b`, `${tmpDir}/d/b`);
  await rename(`${tmpDir}/a/c`, `${tmpDir}/a/b`);
  await rm(`${tmpDir}/a`, { recursive: true });
  await rm(`${tmpDir}/d`, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/b,MOVED_FROM_DIR
${tmpDir}/d/b,MOVED_TO_DIR
${tmpDir}/a/c,MOVED_FROM_DIR
${tmpDir}/a/b,MOVED_TO_DIR
${tmpDir}/a/b,DELETE_DIR
${tmpDir}/a,DELETE_DIR
${tmpDir}/d/b,DELETE_DIR
${tmpDir}/d,DELETE_DIR
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

// TODO misc test
// const tmpDir = await getTmpDir();
// const tmpDir2 = await getTmpDir();
// const n = 100;
// for (let i = 0; i < n; i++) {
//   await mkdir(`${tmpDir}/${i}`);
// }
// // await mkdir(`${tmpDir}/2`);
// const watcher = await createWatcher([tmpDir]);
// for (let i = 0; i < n; i++) {
//   await rename(`${tmpDir}/${i}`, `${tmpDir2}/${i}`);
//   await writeFile(`${tmpDir}/${i}.txt`, "");
//   // await mkdir(`${tmpDir}/${i}`);
// }

test("change folder attribute", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  const watcher = await createWatcher([tmpDir]);
  await exec("chmod", ["-R", "g+s", `${tmpDir}/a`]);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,ATTRIB_DIR
`);
  });
  watcher.dispose();
});

// TODO test softlink and hardlinks

// TODO test exclude

test("exclude node_modules", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/node_modules`);
  const watcher = await createWatcher([tmpDir, "--exclude", "node_modules"]);
  await mkdir(`${tmpDir}/node_modules/lodash`);
  await writeFile(`${tmpDir}/a.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a.txt,CREATE
${tmpDir}/a.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("exclude .git", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/.git/objects`, { recursive: true });
  const watcher = await createWatcher([tmpDir, "--exclude", ".git"]);
  await writeFile(`${tmpDir}/.git/objects/1`, "");
  await writeFile(`${tmpDir}/a.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a.txt,CREATE
${tmpDir}/a.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("creating folder that is excluded", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir, "--exclude", "a"]);
  await mkdir(`${tmpDir}/a`);
  await writeFile(`${tmpDir}/b.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,CREATE_DIR
${tmpDir}/b.txt,CREATE
${tmpDir}/b.txt,CLOSE_WRITE
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/a/a.txt`, "");
  await writeFile(`${tmpDir}/c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/c.txt,CREATE
${tmpDir}/c.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("move out excluded folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  const watcher = await createWatcher([tmpDir, "--exclude", "a"]);
  await rename(`${tmpDir}/a`, `${tmpDir2}/a`);
  await writeFile(`${tmpDir}/b.txt`, ``);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,MOVED_FROM_DIR
${tmpDir}/b.txt,CREATE
${tmpDir}/b.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("move in excluded folder", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  await mkdir(`${tmpDir2}/a`);
  const watcher = await createWatcher([tmpDir, "--exclude", "a"]);
  await rename(`${tmpDir2}/a`, `${tmpDir}/a`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/a/a.txt`, "");
  await writeFile(`${tmpDir}/b.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/b.txt,CREATE
${tmpDir}/b.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("rename excluded folder to non-excluded folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  const watcher = await createWatcher([tmpDir, "--exclude", "a"]);
  await rename(`${tmpDir}/a`, `${tmpDir}/b`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,MOVED_FROM_DIR
${tmpDir}/b,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/b/b.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/b/b.txt,CREATE
${tmpDir}/b/b.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("rename non-excluded folder to excluded folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/b`);
  const watcher = await createWatcher([tmpDir, "--exclude", "a"]);
  await rename(`${tmpDir}/b`, `${tmpDir}/a`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/b,MOVED_FROM_DIR
${tmpDir}/a,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/a/a.txt`, "");
  await writeFile(`${tmpDir}/c.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/c.txt,CREATE
${tmpDir}/c.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("exclude multiple folders", async () => {
  const tmpDir = await getTmpDir();
  await Promise.all([
    mkdir(`${tmpDir}/a`),
    mkdir(`${tmpDir}/b`),
    mkdir(`${tmpDir}/c`),
    mkdir(`${tmpDir}/d`),
  ]);
  const watcher = await createWatcher([
    tmpDir,
    "--exclude",
    "a",
    "--exclude",
    "b",
    "--exclude",
    "c",
  ]);
  await Promise.all([
    writeFile(`${tmpDir}/a/1.txt`, ""),
    writeFile(`${tmpDir}/b/1.txt`, ""),
    writeFile(`${tmpDir}/c/1.txt`, ""),
    writeFile(`${tmpDir}/d/1.txt`, ""),
  ]);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/d/1.txt,CREATE
${tmpDir}/d/1.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("symlinked file", async () => {
  const tmpDir = await getTmpDir();
  await writeFile(`${tmpDir}/a.txt`, "");
  await symlink(`${tmpDir}/a.txt`, `${tmpDir}/b.txt`);
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/a.txt`, "aaa");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a.txt,MODIFY
${tmpDir}/a.txt,MODIFY
${tmpDir}/a.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("symlinked folder", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a`);
  await symlink(`${tmpDir}/a`, `${tmpDir}/b`);
  const watcher = await createWatcher([tmpDir]);
  await writeFile(`${tmpDir}/b/1.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a/1.txt,CREATE
${tmpDir}/a/1.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

// TODO test hardlink

test.skip("delete watched folder", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  await rm(tmpDir, { recursive: true });
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(``);
    expect(watcher.status).toBe("normal");
  });
  watcher.dispose();
});

test("cli help", async () => {
  const watcher = await createCliWatcher(["--help"]);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`hello 0.0.1
Recursively watch a folder for changes
Usage: hello [ options ] sample-folder
Options:
\t-h|--help     \tShow this help text.
\t--exclude <name>
\t              \tExclude all events on files matching <name>
`);
  });
  watcher.dispose();
});

test("cli version", async () => {
  const watcher = await createCliWatcher(["--version"]);
  await waitForExpect(() => {
    expect(watcher.stdout).toMatch(/hello \d+\.\d+\.\d+/);
  });
  watcher.dispose();
});

test("cli missing arguments", async () => {
  const watcher = await createCliWatcher([]);
  await waitForExpect(() => {
    expect(watcher.stderr).toBe(`No files specified to watch!
`);
  });
  watcher.dispose();
});

test("cli invalid option", async () => {
  const watcher = await createCliWatcher(["--exclude   "]);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`Usage: hello [ options ] sample-folder
`);
  });
  watcher.dispose();
});

test("cli unknown option", async () => {
  const watcher = await createCliWatcher(["-k"]);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`Usage: hello [ options ] sample-folder
`);
  });
  watcher.dispose();
});

// TODO move folder inside out

test("rename when moved_to folder name is longer than moved_from", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/a/b/c`, { recursive: true });
  await mkdir(`${tmpDir}/f`);
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/a`, `${tmpDir}/f2`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,MOVED_FROM_DIR
${tmpDir}/f2,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/f2/g.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/f2/g.txt,CREATE
${tmpDir}/f2/g.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});

test("rename when moved_from folder name is longer than moved_to", async () => {
  const tmpDir = await getTmpDir();
  await mkdir(`${tmpDir}/f2`);
  await mkdir(`${tmpDir}/a/b/c`, { recursive: true });
  const watcher = await createWatcher([tmpDir]);
  await rename(`${tmpDir}/a`, `${tmpDir}/f`);
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/a,MOVED_FROM_DIR
${tmpDir}/f,MOVED_TO_DIR
`);
  });
  watcher.clear();
  await writeFile(`${tmpDir}/f/g.txt`, "");
  await waitForExpect(() => {
    expect(watcher.stdout).toBe(`${tmpDir}/f/g.txt,CREATE
${tmpDir}/f/g.txt,CLOSE_WRITE
`);
  });
  watcher.dispose();
});
