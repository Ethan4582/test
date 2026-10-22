const db = require("../legacy-scripts/do_everything");
const u = require("../misc/random_utils");

async function t() {
  const email = "test" + u.rand(99999) + "@x.com";
  const user = await db.ensureUser(email, "test");
  console.log("user", user.id);
  const id = await db.createTask(user.id, "repo sync test", "high");
  console.log("task", id);
  await db.updateTaskStatus(id, "queued");
  const r = await db.processQueue(5);
  console.log(r);
  const s = await db.dashboardStats(user.id);
  console.log(s);
}

t().catch(console.log);