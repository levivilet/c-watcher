import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pidusage from "pidusage";
import { setTimeout } from "node:timers/promises";
import waitForExpect from "wait-for-expect";

const getStats = async (pid) => {
  const stats = await pidusage(pid);
  return stats;
};

const getTmpDir = () => {
  return mkdtemp(join(tmpdir(), "foo-"));
};

const waitForWatcherReady = async (child) => {
  await new Promise((resolve) => {
    const cleanup = () => {
      child.stderr.off("data", handleData);
      resolve(undefined);
    };
    const handleData = (data) => {
      if (data.toString().includes("Watches established.")) {
        cleanup();
      }
    };
    child.stderr.on("data", handleData);
  });
};

/**
 *
 * @param {readonly string[]} args
 * @param {import('child_process').SpawnOptions} options
 * @returns
 */
export const createWatcher = async (args = [], options = {}) => {
  const child = spawn("./hello", args, options);
  if (!child.stdout) {
    throw new Error(`stdout is not available`);
  }
  let eventCount = 0;
  child.stdout.on("data", (data) => {
    eventCount += data.toString().split("\n").length - 1;
  });
  await waitForWatcherReady(child);
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

beforeAll(() => {
  waitForExpect.defaults.timeout = 10_000;
});

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
}, 60_000);

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
  expect(middleStats2.memory).toBeLessThanOrEqual(middleStats1.memory);
  expect(middleStats3.memory).toBeLessThanOrEqual(middleStats2.memory);
  expect(middleStats4.memory).toBeLessThanOrEqual(middleStats3.memory);
  expect(finalStats.memory).toBeLessThanOrEqual(middleStats4.memory);
  watcher.dispose();
}, 60_000);

test("memory should not grow when moving out folders", async () => {
  const RUNS = 5_000;
  const tmpDir = await getTmpDir();
  const tmpDir2 = await getTmpDir();
  const watcher = await createWatcher([tmpDir]);
  const initialStats = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await mkdir(`${tmpDir}/1-${i}`);
  }
  // TODO timeouts are bad
  await setTimeout(3000);
  const middleStats1 = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await rename(`${tmpDir}/1-${i}`, `${tmpDir2}/1-${i}`);
  }
  for (let i = 0; i < RUNS; i++) {
    await mkdir(`${tmpDir}/2-${i}`);
  }
  await setTimeout(3000);
  const middleStats2 = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await rename(`${tmpDir}/2-${i}`, `${tmpDir2}/2-${i}`);
  }
  for (let i = 0; i < RUNS; i++) {
    await mkdir(`${tmpDir}/3-${i}`);
  }
  await setTimeout(3000);
  const middleStats3 = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await rename(`${tmpDir}/3-${i}`, `${tmpDir2}/3-${i}`);
  }
  for (let i = 0; i < RUNS; i++) {
    await mkdir(`${tmpDir}/4-${i}`);
  }
  await setTimeout(3000);
  const middleStats4 = await getStats(watcher.pid);
  for (let i = 0; i < RUNS; i++) {
    await rename(`${tmpDir}/4-${i}`, `${tmpDir2}/4-${i}`);
  }
  const finalStats = await getStats(watcher.pid);
  console.info(`memory before: ${initialStats.memory}`);
  console.info(`memory middle 1: ${middleStats1.memory}`);
  console.info(`memory middle 2: ${middleStats2.memory}`);
  console.info(`memory middle 3: ${middleStats3.memory}`);
  console.info(`memory middle 4: ${middleStats4.memory}`);
  console.info(`memory after: ${finalStats.memory}`);
  expect(middleStats1.memory).toBeGreaterThan(initialStats.memory);
  expect(middleStats2.memory).toBeLessThanOrEqual(middleStats1.memory);
  expect(middleStats3.memory).toBeLessThanOrEqual(middleStats2.memory);
  expect(middleStats4.memory).toBeLessThanOrEqual(middleStats3.memory);
  expect(finalStats.memory).toBeLessThanOrEqual(middleStats4.memory);
  watcher.dispose();
}, 60_000);
