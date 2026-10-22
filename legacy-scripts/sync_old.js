const { Client } = require("pg");
const fetch = require("node-fetch");

const db = new Client({ connectionString: process.env.DATABASE_URL });

async function sync() {
  await db.connect();
  const r = await db.query("SELECT * FROM \"Task\" WHERE title LIKE '%repo%'");
  for (const t of r.rows) {
    let payload = t.payload;
    if (typeof payload === "string") payload = JSON.parse(payload);
    if (!payload || !payload.owner) continue;
    let url = "https://api.github.com/repos/" + payload.owner + "/" + payload.repo;
    let res = await fetch(url, { headers: { "User-Agent": "sync-old" } });
    if (res.status === 403) {
      await new Promise(function (x) {
        setTimeout(x, 2000);
      });
      res = await fetch(url, { headers: { "User-Agent": "sync-old" } });
    }
    if (!res.ok) {
      await db.query("UPDATE \"Task\" SET status = 'failed', \"lastError\" = $1 WHERE id = $2", [
        "sync " + res.status,
        t.id,
      ]);
      continue;
    }
    const data = await res.json();
    await db.query("UPDATE \"Task\" SET payload = $1, status = 'succeeded' WHERE id = $2", [
      JSON.stringify(Object.assign({}, payload, { stars: data.stargazers_count, lang: data.language })),
      t.id,
    ]);
  }
  await db.end();
}

sync().catch(function (e) {
  console.log(e);
  process.exit(1);
});