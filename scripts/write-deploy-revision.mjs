import { execSync } from "node:child_process";
import fs from "node:fs";

let sha =
  process.env.GIT_COMMIT?.trim() ||
  process.env.RENDER_GIT_COMMIT?.trim() ||
  process.env.SOURCE_VERSION?.trim() ||
  "";
if (!sha) {
  try {
    sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    sha = "";
  }
}
if (sha) {
  fs.writeFileSync(".deploy-revision", `${sha}\n`);
  console.log("==> deploy revision", sha.slice(0, 12));
} else {
  console.log("==> deploy revision unknown (no git SHA)");
}

let history = [];
try {
  const raw = execSync("git log -20 --pretty=format:%h%x09%s", { encoding: "utf8" });
  history = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      return { commit: tab >= 0 ? line.slice(0, tab) : line, summary: tab >= 0 ? line.slice(tab + 1) : "" };
    });
} catch {
  history = sha ? [{ commit: sha.slice(0, 7), summary: "Deployed revision" }] : [];
}
fs.writeFileSync("deploy-history.json", `${JSON.stringify({ generatedAt: new Date().toISOString(), history }, null, 2)}\n`);
console.log("==> deploy history", history.length, "commits");
