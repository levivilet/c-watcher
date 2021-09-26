import { spawn } from "child_process";

const createWatcher = () => {
  const child = spawn("./hello");
  return child;
};

test("spawn", () => {
  const watcher = createWatcher();
  watcher.kill();
});
