import fs from "fs";
import { versions } from "./versions.json";

const targetVersion = process.env.npm_config_target_version;

if (!targetVersion) {
  throw new Error("No target version specified.");
}

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
manifest.version = targetVersion;
fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

versions[targetVersion] = manifest.minAppVersion;
fs.writeFileSync("versions.json", JSON.stringify({ versions }, null, "\t"));
