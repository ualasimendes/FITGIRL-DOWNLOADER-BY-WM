import { spawn } from "child_process";

console.log("\n[DevRunner] =====================================================");
console.log("[DevRunner] Starting FITGIRL DOWNLOADER BY WM Development Server...");
console.log("[DevRunner] =====================================================\n");

// 1. Start the API/Vite server (tsx server.ts)
const serverProcess = spawn("npx", ["tsx", "server.ts"], {
  stdio: "inherit",
  shell: true,
});

// 2. Check if we should start Electron
// We skip Electron if we are on headless Linux (no display server) OR if explicitly disabled
const isHeadlessLinux = process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
const skipElectron = isHeadlessLinux || process.env.DISABLE_ELECTRON === "true";

if (skipElectron) {
  console.log("[DevRunner] Headless/Cloud environment detected. Running API and Web Client only.");
  console.log("[DevRunner] Skipping Electron GUI spawn to prevent headless crashes.\n");
} else {
  console.log("[DevRunner] GUI environment detected. Starting Electron desktop application...");
  
  // Wait 3 seconds for the server to spin up before launching Electron
  setTimeout(() => {
    const electronProcess = spawn("npx", ["electron", "."], {
      stdio: "inherit",
      shell: true,
    });

    electronProcess.on("exit", (code) => {
      console.log(`[DevRunner] Electron application exited with code ${code}`);
      serverProcess.kill();
      process.exit(code || 0);
    });
  }, 3000);
}

serverProcess.on("exit", (code) => {
  console.log(`[DevRunner] Backend server process exited with code ${code}`);
  process.exit(code || 0);
});
