const http = require("http");

async function main() {
  const url =
    "http://localhost:3000/analytics/tokens/SOUL/top-movers?windowDays=7&limit=50";

  http
    .get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          console.log("Status Code:", res.statusCode);
          console.log("Body:", data);
          return;
        }
        try {
          const response = JSON.parse(data);
          const movers = response.data?.items || response.items || [];
          const targetAddress =
            "P2K4gBGN4fTez9yonEsSWi8zqjasUyRSVoBMMvjahJGjg3Z";
          const mover = movers.find((m) => m.address === targetAddress);

          console.log("\n=== Top Movers Response ===");
          console.log("Total items:", movers.length);
          console.log("\nFirst 5 movers:");
          movers.slice(0, 5).forEach((m, i) => {
            console.log(`\n[${i + 1}] ${m.address}`);
            console.log("  Latest:", m.latestBalance);
            console.log("  Baseline:", m.baselineBalance);
            console.log("  Delta:", m.deltaBalance);
            console.log("  Delta %:", m.deltaPct);
          });

          if (mover) {
            console.log("\n\n=== Target Address Deep Dive ===");
            console.log("Address:", mover.address);
            console.log("Latest Balance:", mover.latestBalance);
            console.log("Baseline Balance:", mover.baselineBalance);
            console.log("Delta Balance:", mover.deltaBalance);
            console.log("Delta Pct (from API):", mover.deltaPct);

            const hasBaseline =
              mover.baselineBalance && mover.baselineBalance !== 0;
            const calc1 = hasBaseline
              ? (mover.deltaBalance / mover.baselineBalance) * 100
              : null;
            const calc2 =
              mover.latestBalance && mover.latestBalance !== 0
                ? (mover.deltaBalance / mover.latestBalance) * 100
                : null;

            console.log("\nMath Verification:");
            console.log("(deltaBalance / baselineBalance * 100):", calc1);
            console.log("(deltaBalance / latestBalance * 100):", calc2);
            console.log(
              "API deltaPct matches calc1?",
              Math.abs((calc1 || 0) - (mover.deltaPct || 0)) < 0.01,
            );
          } else {
            console.log(
              "\nAddress " + targetAddress + " not found in top 50 movers.",
            );
            console.log(
              "Sample addresses returned:",
              movers.slice(0, 3).map((m) => m.address),
            );
          }
        } catch (e) {
          console.error("Error parsing JSON:", e.message);
        }
      });
    })
    .on("error", (err) => {
      console.error("Error:", err.message);
    });
}

main();
