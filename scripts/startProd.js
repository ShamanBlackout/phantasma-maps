const { spawnSync } = require("child_process");
const path = require("path");

function run(binName, args) {
  const ext = process.platform === "win32" ? ".cmd" : "";
  const binPath = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    `${binName}${ext}`,
  );
  const result = spawnSync(binPath, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.error) {
    console.error(`Failed to run ${binName}:`, result.error.message);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function runNodeScript(scriptRelativePath) {
  const scriptPath = path.join(process.cwd(), scriptRelativePath);
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (result.error) {
    console.error(`Failed to run ${scriptRelativePath}:`, result.error.message);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

const port = process.env.PORT || "3000";

runNodeScript("sammy.js");
run("react-scripts", ["build"]);
run("serve", ["-s", "build", "-l", `tcp://0.0.0.0:${port}`, "-n"]);
