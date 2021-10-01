import { spawn } from "child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import pidusage from "pidusage";
import waitForExpect from "wait-for-expect";

const getStats = async (pid) => {
  const stats = await pidusage(pid);
  return stats;
};

const getTmpDir = () => {
  return mkdtemp(join(tmpdir(), "foo-"));
};

/**
 *
 * @param {readonly string[]} args
 * @param {import('child_process').SpawnOptions} options
 * @returns
 */
export const createWatcher = async (args = [], options = {}) => {
  const child = spawn("./hello", args, options);
  await new Promise((resolve) => {
    const handleData = (data) => {
      if (data.toString().includes("Watches established.")) {
        child.stderr.off("data", handleData);
        resolve();
      }
    };
    child.stderr.on("data", handleData);
  });
  let eventCount = 0;
  child.stdout.on("data", (data) => {
    eventCount += data.toString().split("\n").length - 1;
  });
  return {
    dispose() {
      child.kill();
    },
    get pid() {
      return child.pid;
    },
    get eventCount() {
      return eventCount;
    },
  };
};

test("memory should stay the same when adding files", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const initialStats = await getStats(watcher.pid);
  for (let i = 0; i < 10_000; i++) {
    await writeFile(`${tmpDir}/${i}.txt`, "");
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(20_000);
  });
  const finalStats = await getStats(watcher.pid);
  expect(initialStats.memory).toBe(finalStats.memory);
  watcher.dispose();
}, 20_000);

test("memory should not grow when adding and removing folders", async () => {
  const tmpDir = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const initialStats = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/1-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(5_000);
  });
  const middleStats1 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rm(`${tmpDir}/1-${i}`, { recursive: true });
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(10_000);
  });
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/2-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(15_000);
  });
  const middleStats2 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rm(`${tmpDir}/2-${i}`, { recursive: true });
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(20_000);
  });
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/3-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(25_000);
  });
  const middleStats3 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rm(`${tmpDir}/3-${i}`, { recursive: true });
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(30_000);
  });
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/4-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(35_000);
  });
  const middleStats4 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rm(`${tmpDir}/4-${i}`, { recursive: true });
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(40_000);
  });
  const finalStats = await getStats(watcher.pid);
  expect(middleStats1.memory).toBeGreaterThan(initialStats.memory);
  expect(middleStats2.memory).toBe(middleStats3.memory);
  expect(middleStats3.memory).toBe(middleStats4.memory);
  expect(middleStats4.memory).toBe(finalStats.memory);
  watcher.dispose();
}, 40_000);

test.skip("memory should not grow when moving out folders", async () => {
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const initialStats = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/1-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(5_000);
  });
  const middleStats1 = await getStats(watcher.pid);
  // await setTimeout(100);
  for (let i = 0; i < 5_000; i++) {
    await rename(`${tmpDir}/1-${i}`, `${tmpDir2}/1-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(10_000);
  });
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/2-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(15_000);
  });
  const middleStats2 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rename(`${tmpDir}/2-${i}`, `${tmpDir2}/2-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(20_000);
  });
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/3-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(25_000);
  });
  const middleStats3 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rename(`${tmpDir}/3-${i}`, `${tmpDir2}/3-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(30_000);
  });
  for (let i = 0; i < 5_000; i++) {
    await mkdir(`${tmpDir}/4-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(35_000);
  });
  const middleStats4 = await getStats(watcher.pid);
  for (let i = 0; i < 5_000; i++) {
    await rename(`${tmpDir}/4-${i}`, `${tmpDir2}/4-${i}`);
  }
  await waitForExpect(() => {
    expect(watcher.eventCount).toBe(40_000);
  });
  const finalStats = await getStats(watcher.pid);
  expect(middleStats1.memory).toBeGreaterThan(initialStats.memory);
  expect(middleStats2.memory).toBe(middleStats3.memory);
  expect(middleStats3.memory).toBe(middleStats4.memory);
  expect(middleStats4.memory).toBe(finalStats.memory);
  watcher.dispose();
}, 40_000);
