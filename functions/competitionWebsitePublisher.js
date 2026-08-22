"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

function copyTree(source, target) {
  fs.cpSync(source, target, { recursive:true, force:true });
}

function createWorkspace(baseDir = os.tmpdir()) {
  const root = fs.mkdtempSync(path.join(baseDir, "cat-archery-publish-"));
  fs.mkdirSync(path.join(root, "scripts", "website"), { recursive:true });
  fs.mkdirSync(path.join(root, "website"), { recursive:true });
  return root;
}

function sha1(buffer) { return crypto.createHash("sha1").update(buffer).digest("hex"); }

function collectFiles(dir) {
  const out = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes:true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const body = fs.readFileSync(full);
        out.push({ file:path.relative(dir, full).split(path.sep).join("/"), sha:sha1(body), size:body.length, body });
      }
    }
  };
  walk(dir);
  return out.sort((a,b)=>a.file.localeCompare(b.file));
}

function normalizeConfig(raw) {
  let value = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch { throw new Error("CAT_ARCHERY_VERCEL must be valid JSON"); }
  }
  const token = String(value?.token || "").trim();
  const teamId = String(value?.teamId || "").trim();
  const projectName = String(value?.projectName || "catarrow-archery").trim();
  if (!token || !teamId || !projectName) throw new Error("CAT_ARCHERY_VERCEL requires token, teamId and projectName");
  return { token, teamId, projectName };
}

async function vercelRequest(url, options, fetchImpl = fetch) {
  const res = await fetchImpl(url, options);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw:text }; }
  if (!res.ok) throw new Error(`Vercel API ${res.status}: ${data?.error?.message || data?.message || text.slice(0,300)}`);
  return data;
}

async function uploadFiles(files, config, fetchImpl = fetch, concurrency = 5) {
  let cursor = 0;
  const workers = Array.from({ length:Math.min(concurrency, Math.max(files.length,1)) }, async () => {
    while (cursor < files.length) {
      const item = files[cursor++];
      await vercelRequest(`https://api.vercel.com/v2/now/files?teamId=${encodeURIComponent(config.teamId)}`, {
        method:"POST",
        headers:{ Authorization:`Bearer ${config.token}`, "x-vercel-digest":item.sha, "content-length":String(item.size), "content-type":"application/octet-stream" },
        body:item.body,
      }, fetchImpl);
    }
  });
  await Promise.all(workers);
}

async function createDeployment(files, config, fetchImpl = fetch) {
  return vercelRequest(`https://api.vercel.com/v12/now/deployments?teamId=${encodeURIComponent(config.teamId)}`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${config.token}`, "content-type":"application/json" },
    body:JSON.stringify({
      name:config.projectName,
      target:"production",
      files:files.map(({file,sha,size})=>({ file, sha, size })),
      projectSettings:{ framework:null },
    }),
  }, fetchImpl);
}

async function deployDirectory(dir, rawConfig, fetchImpl = fetch) {
  const config = normalizeConfig(rawConfig);
  const files = collectFiles(dir);
  if (!files.length) throw new Error("website template is empty");
  await uploadFiles(files, config, fetchImpl);
  const deployment = await createDeployment(files, config, fetchImpl);
  return { id:deployment.id || "", url:deployment.url ? `https://${deployment.url}` : "", readyState:deployment.readyState || deployment.status || "QUEUED", fileCount:files.length };
}

module.exports = { copyTree, createWorkspace, sha1, collectFiles, normalizeConfig, deployDirectory, uploadFiles, createDeployment };
