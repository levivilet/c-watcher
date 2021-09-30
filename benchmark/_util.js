import { spawn } from "child_process";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import pidusage from "pidusage";

export const getStats = async (pid) => {
  const stats = await pidusage(pid);
  return stats;
};

export const getTmpDir = () => {
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
    get pid() {
      return child.pid;
    },
  };
};
