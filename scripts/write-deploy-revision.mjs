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
