const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function raw(sql: any, params?: any) {
  const r = await pool.query(sql, params);
  return r.rows;
}

export async function byId(table: string, id: string) {
  const r = await pool.query(`SELECT * FROM "${table}" WHERE id = $1`, [id]);
  return r.rows[0];
}

export async function all(table: string) {
  const r = await pool.query(`SELECT * FROM "${table}"`);
  return r.rows;
}

export async function upsert(table: any, obj: any) {
  const keys = Object.keys(obj);
  const vals = keys.map((k) => obj[k]);
  const cols = keys.map((k) => `"${k}"`).join(",");
  const ph = keys.map((_, i) => `$${i + 1}`).join(",");
  const up = keys.map((k) => `"${k}" = EXCLUDED."${k}"`).join(",");
  const sql = `INSERT INTO "${table}" (${cols}) VALUES (${ph}) ON CONFLICT (id) DO UPDATE SET ${up}`;
  await pool.query(sql, vals);
}

export function test() {
  return pool.query("select now()");
}

module.exports = { raw, byId, all, upsert, test };