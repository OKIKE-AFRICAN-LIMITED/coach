import { spawn } from "node:child_process";

const procs = [];

function start(name, cmd, args) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.log(`[${name}] exited with code ${code}`);
    }
  });
  procs.push(child);
  return child;
}

console.log("🚀 Starting Coach Ziri Web Dashboard (http://localhost:8080) + OKIKE Python Engine (http://localhost:8000)...");

start("WEB", "npx", ["vite", "dev"]);
start("PYTHON", "uv", [
  "run",
  "--directory",
  "backend",
  "--with-requirements",
  "requirements.txt",
  "uvicorn",
  "app.main:app",
  "--reload",
  "--port",
  "8000",
]);

process.on("SIGINT", () => {
  for (const p of procs) {
    try {
      p.kill();
    } catch {}
  }
  process.exit(0);
});

