import { spawn } from "child_process";
import { createWriteStream } from "fs";
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
 * @param {any} options
 * @returns
 */
export const createWatcher = async (args = [], options = {}) => {
  const child = spawn("./hello", args, options);
  let result = "";
  if (options.pipe) {
    child.stdout.pipe(createWriteStream("./out.txt"));
  } else {
    child.stdout.on("data", (data) => {
      result += data.toString();
    });
  }
  child.on("exit", () => {
    console.info("exit");
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
