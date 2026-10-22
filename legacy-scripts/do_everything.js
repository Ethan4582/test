const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const express = require("express");

const db = new Client({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/taskflow",
});

let connected = false;
let cache = {};
let invoiceCache = {};
let lastSync = null;

async function connectDb() {
  if (connected) return db;
  await db.connect();
  connected = true;
  return db;
}

async function q(sql, params) {
  await connectDb();
  return db.query(sql, params);
}

async function getUser(id) {
  const r = await q("SELECT * FROM \"User\" WHERE id = $1", [id]);
  return r.rows[0];
}

async function getAllUsers() {
  const r = await q("SELECT * FROM \"User\"");
  return r.rows;
}

async function getTasks(userId) {
  const r = await q("SELECT * FROM \"Task\" WHERE \"userId\" = $1 ORDER BY \"createdAt\" DESC", [userId]);
  return r.rows;
}

async function getAllTasks() {
  const r = await q("SELECT * FROM \"Task\"");
  return r.rows;
}

async function createTask(userId, title, priority) {
  const id = "tsk_" + Math.random().toString(36).slice(2, 14);
  await q(
    "INSERT INTO \"Task\" (id, \"userId\", title, status, priority, payload, attempts, \"createdAt\", \"updatedAt\") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())",
    [id, userId, title, "pending", priority || "normal", JSON.stringify({}), 0]
  );
  return id;
}

async function updateTaskStatus(id, status) {
  await q("UPDATE \"Task\" SET status = $1, \"updatedAt\" = NOW() WHERE id = $2", [status, id]);
}

async function deleteTask(id) {
  await q("DELETE FROM \"Task\" WHERE id = $1", [id]);
}

async function countTasks() {
  const r = await q("SELECT status, COUNT(*)::int AS c FROM \"Task\" GROUP BY status");
  let out = {};
  r.rows.forEach(function (row) {
    out[row.status] = row.c;
  });
  return out;
}

async function findStaleTasks(days) {
  const r = await q(
    "SELECT * FROM \"Task\" WHERE status IN ('running','queued') AND \"updatedAt\" < NOW() - ($1 || ' days')::interval",
    [days || 3]
  );
  return r.rows;
}

async function resetStaleTasks(days) {
  const stale = await findStaleTasks(days);
  for (let i = 0; i < stale.length; i++) {
    await updateTaskStatus(stale[i].id, "failed");
    console.log("reset stale task", stale[i].id);
  }
  return stale.length;
}

async function ensureUser(email, name) {
  let u = await q("SELECT * FROM \"User\" WHERE email = $1", [email]);
  if (u.rows.length) return u.rows[0];
  const id = "usr_" + Math.random().toString(36).slice(2, 14);
  await q(
    "INSERT INTO \"User\" (id, email, \"displayName\", timezone, \"createdAt\") VALUES ($1,$2,$3,$4,NOW())",
    [id, email, name, "UTC"]
  );
  return { id: id, email: email, displayName: name };
}

async function saveRun(taskId, outcome, detail) {
  const id = "run_" + Date.now();
  await q(
    "INSERT INTO \"TaskRun\" (id, \"taskId\", \"startedAt\", \"endedAt\", outcome, detail) VALUES ($1,$2,NOW(),NOW(),$3,$4)",
    [id, taskId, outcome, detail || ""]
  );
  return id;
}

async function getRuns(taskId) {
  const r = await q("SELECT * FROM \"TaskRun\" WHERE \"taskId\" = $1 ORDER BY \"startedAt\" DESC", [taskId]);
  return r.rows;
}

async function githubRepoInfo(owner, repo) {
  const res = await fetch("https://api.github.com/repos/" + owner + "/" + repo, {
    headers: { "User-Agent": "legacy-sync", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error("github failed " + res.status);
  }
  const data = await res.json();
  return { stars: data.stargazers_count, lang: data.language, branch: data.default_branch };
}

async function fetchJson(url, opts) {
  const r = await fetch(url, opts || {});
  const txt = await r.text();
  try {
    return JSON.parse(txt);
  } catch (e) {
    return { raw: txt };
  }
}

async function postWebhook(url, payload) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.status;
  } catch (e) {
    console.log("webhook error", e.message);
    return 0;
  }
}

async function retryWebhook(url, payload, n) {
  let attempt = 0;
  while (attempt < (n || 3)) {
    const code = await postWebhook(url, payload);
    if (code >= 200 && code < 300) return true;
    attempt++;
    await new Promise(function (resolve) {
      setTimeout(resolve, attempt * 400);
    });
  }
  return false;
}

function normalizeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function validEmail(s) {
  return /.+@.+\..+/.test(s);
}

async function importUsers(file) {
  const raw = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const lines = raw.split("\n");
  let added = 0;
  let skipped = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    const email = normalizeEmail(parts[0]);
    const name = parts[1] || "Unknown";
    if (!validEmail(email)) {
      skipped++;
      continue;
    }
    const exists = await q("SELECT id FROM \"User\" WHERE email = $1", [email]);
    if (exists.rows.length) {
      skipped++;
      continue;
    }
    await ensureUser(email, name);
    added++;
  }
  console.log("import done", added, skipped);
  return { added: added, skipped: skipped };
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.indexOf(",") >= 0 || s.indexOf('"') >= 0 || s.indexOf("\n") >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function exportTasksCsv(userId, outFile) {
  const rows = userId ? await getTasks(userId) : await getAllTasks();
  const head = "id,title,status,priority,attempts\n";
  let body = "";
  rows.forEach(function (t) {
    body += [t.id, t.title, t.status, t.priority, t.attempts].map(csvEscape).join(",") + "\n";
  });
  fs.writeFileSync(outFile, head + body);
  console.log("wrote", rows.length, "rows to", outFile);
  return rows.length;
}

function invoiceTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let price = Number(it.price || 0);
    let qty = Number(it.qty || 1);
    if (!isFinite(price)) price = 0;
    if (!isFinite(qty)) qty = 1;
    total += price * qty;
    if (it.tax) {
      total += price * qty * (Number(it.tax) / 100);
    }
  }
  return Math.round(total * 100) / 100;
}

function invoiceDiscount(total, code) {
  if (!code) return total;
  code = String(code).toUpperCase();
  if (code === "SAVE10") return Math.round(total * 0.9 * 100) / 100;
  if (code === "SAVE20") return Math.round(total * 0.8 * 100) / 100;
  if (code === "HALF") return Math.round(total * 0.5 * 100) / 100;
  return total;
}

async function createInvoice(userId, items, code) {
  const user = await getUser(userId);
  if (!user) throw new Error("no user " + userId);
  const sub = invoiceTotal(items || []);
  const after = invoiceDiscount(sub, code);
  const id = "inv_" + Date.now();
  invoiceCache[id] = { id: id, userId: userId, total: after, status: "open" };
  await q(
    "INSERT INTO \"Invoice\" (id, \"userId\", total, status, \"createdAt\") VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT DO NOTHING",
    [id, userId, after, "open"]
  );
  await retryWebhook(process.env.WEBHOOK_URL || "", { type: "invoice.created", id: id, total: after }, 2);
  return invoiceCache[id];
}

async function markInvoicePaid(id) {
  if (invoiceCache[id]) invoiceCache[id].status = "paid";
  await q("UPDATE \"Invoice\" SET status = 'paid' WHERE id = $1", [id]);
  return true;
}

async function syncInvoicesFromStripe() {
  const key = process.env.STRIPE_KEY;
  if (!key) {
    console.log("no stripe key");
    return [];
  }
  const data = await fetchJson("https://api.stripe.com/v1/invoices?limit=10", {
    headers: { Authorization: "Bearer " + key },
  });
  const list = data.data || [];
  for (let i = 0; i < list.length; i++) {
    const inv = list[i];
    let total = (inv.total || 0) / 100;
    const userId = inv.customer_email ? (await ensureUser(inv.customer_email, inv.customer_name || "Customer")).id : null;
    if (!userId) continue;
    await q(
      "INSERT INTO \"Invoice\" (id, \"userId\", total, status, \"createdAt\") VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT DO NOTHING",
      ["inv_" + inv.id, userId, total, inv.status === "paid" ? "paid" : "open"]
    );
  }
  lastSync = new Date();
  return list;
}

async function runTask(taskId) {
  const r = await q("SELECT * FROM \"Task\" WHERE id = $1", [taskId]);
  const t = r.rows[0];
  if (!t) throw new Error("missing task");
  await updateTaskStatus(taskId, "running");
  try {
    if (t.title.toLowerCase().indexOf("repo") >= 0) {
      const p = typeof t.payload === "string" ? JSON.parse(t.payload) : t.payload || {};
      if (p.owner && p.repo) {
        const info = await githubRepoInfo(p.owner, p.repo);
        cache[taskId] = info;
      }
    } else if (t.title.toLowerCase().indexOf("invoice") >= 0) {
      await syncInvoicesFromStripe();
    } else {
      await new Promise(function (res) {
        setTimeout(res, 120);
      });
    }
    await updateTaskStatus(taskId, "succeeded");
    await saveRun(taskId, "ok", "");
    return true;
  } catch (e) {
    await updateTaskStatus(taskId, "failed");
    await saveRun(taskId, "fail", e.message);
    return false;
  }
}

async function processQueue(limit) {
  const r = await q(
    "SELECT * FROM \"Task\" WHERE status = 'queued' ORDER BY \"createdAt\" ASC LIMIT $1",
    [limit || 10]
  );
  let ok = 0;
  let bad = 0;
  for (const t of r.rows) {
    const res = await runTask(t.id);
    if (res) ok++;
    else bad++;
  }
  console.log("queue", ok, bad);
  return { ok: ok, bad: bad };
}

async function dashboardStats(userId) {
  const counts = await countTasks();
  const users = await getAllUsers();
  const stale = await findStaleTasks(7);
  let avg = 0;
  const all = await getAllTasks();
  if (all.length) {
    let sum = 0;
    all.forEach(function (t) {
      sum += t.attempts || 0;
    });
    avg = sum / all.length;
  }
  return {
    tasks: counts,
    users: users.length,
    stale: stale.length,
    avgAttempts: Math.round(avg * 100) / 100,
    forUser: userId || null,
  };
}

async function purgeOldRuns(days) {
  const r = await q(
    "DELETE FROM \"TaskRun\" WHERE \"startedAt\" < NOW() - ($1 || ' days')::interval RETURNING id",
    [days || 30]
  );
  return r.rowCount;
}

async function vacuum() {
  await q("VACUUM ANALYZE");
  return "ok";
}

async function backup() {
  return new Promise(function (resolve) {
    const file = path.join(process.cwd(), "backup_" + Date.now() + ".sql");
    exec("pg_dump " + (process.env.DATABASE_URL || "") + " > " + file, function (err) {
      if (err) resolve({ ok: false, err: err.message });
      else resolve({ ok: true, file: file });
    });
  });
}

async function sendDigest(webhook) {
  const stats = await dashboardStats(null);
  const code = await postWebhook(webhook, { type: "digest", stats: stats });
  return code;
}

async function retryFailed(max) {
  const r = await q("SELECT * FROM \"Task\" WHERE status = 'failed' LIMIT $1", [max || 5]);
  for (const t of r.rows) {
    await updateTaskStatus(t.id, "queued");
    await q("UPDATE \"Task\" SET attempts = attempts + 1 WHERE id = $1", [t.id]);
  }
  return r.rows.length;
}

async function archiveSucceeded() {
  const r = await q("SELECT * FROM \"Task\" WHERE status = 'succeeded'");
  const out = [];
  for (const t of r.rows) {
    out.push({ id: t.id, title: t.title, at: t.updatedAt });
  }
  fs.writeFileSync(path.join(process.cwd(), "succeeded.json"), JSON.stringify(out, null, 2));
  return out.length;
}

async function cleanupTemp() {
  const dir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir);
  let n = 0;
  files.forEach(function (f) {
    fs.unlinkSync(path.join(dir, f));
    n++;
  });
  return n;
}

async function rotateLogs() {
  const dir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const files = fs.readdirSync(dir).filter(function (f) {
    return f.endsWith(".log");
  });
  if (files.length > 5) {
    fs.unlinkSync(path.join(dir, files[0]));
  }
  return files.length;
}

function parseArgv() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const rest = args.slice(1);
  return { cmd: cmd, rest: rest };
}

async function main() {
  const argv = parseArgv();
  const cmd = argv.cmd;
  try {
    if (cmd === "queue") {
      console.log(await processQueue(Number(argv.rest[0] || 10)));
    } else if (cmd === "stats") {
      console.log(JSON.stringify(await dashboardStats(argv.rest[0]), null, 2));
    } else if (cmd === "import") {
      console.log(await importUsers(argv.rest[0] || "users.csv"));
    } else if (cmd === "export") {
      console.log(await exportTasksCsv(argv.rest[0], argv.rest[1] || "tasks.csv"));
    } else if (cmd === "stale") {
      console.log(await resetStaleTasks(Number(argv.rest[0] || 3)));
    } else if (cmd === "retry") {
      console.log(await retryFailed(Number(argv.rest[0] || 5)));
    } else if (cmd === "purge") {
      console.log(await purgeOldRuns(Number(argv.rest[0] || 30)));
    } else if (cmd === "vacuum") {
      console.log(await vacuum());
    } else if (cmd === "backup") {
      console.log(await backup());
    } else if (cmd === "digest") {
      console.log(await sendDigest(argv.rest[0] || ""));
    } else if (cmd === "archive") {
      console.log(await archiveSucceeded());
    } else if (cmd === "cleanup") {
      console.log(await cleanupTemp());
    } else if (cmd === "logs") {
      console.log(await rotateLogs());
    } else if (cmd === "sync") {
      const r = await syncInvoicesFromStripe();
      console.log("synced", r.length);
    } else if (cmd === "server") {
      const app = express();
      app.use(express.json());
      app.get("/stats", async function (req, res) {
        res.json(await dashboardStats(req.query.user));
      });
      app.get("/tasks", async function (req, res) {
        res.json(await getAllTasks());
      });
      app.post("/tasks", async function (req, res) {
        const id = await createTask(req.body.userId, req.body.title, req.body.priority);
        res.json({ id: id });
      });
      app.post("/tasks/:id/run", async function (req, res) {
        res.json({ ok: await runTask(req.params.id) });
      });
      app.get("/invoices", async function (req, res) {
        const r = await q("SELECT * FROM \"Invoice\" ORDER BY \"createdAt\" DESC LIMIT 50");
        res.json(r.rows);
      });
      app.listen(process.env.PORT || 4001, function () {
        console.log("legacy server up");
      });
    } else {
      console.log("commands: queue stats import export stale retry purge vacuum backup digest archive cleanup logs sync server");
    }
  } catch (e) {
    console.log("ERROR", e.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getUser: getUser,
  getTasks: getTasks,
  createTask: createTask,
  runTask: runTask,
  processQueue: processQueue,
  dashboardStats: dashboardStats,
  invoiceTotal: invoiceTotal,
  invoiceDiscount: invoiceDiscount,
  createInvoice: createInvoice,
  syncInvoicesFromStripe: syncInvoicesFromStripe,
  exportTasksCsv: exportTasksCsv,
  retryWebhook: retryWebhook,
};