const base = process.env.API_URL || "http://localhost:4001";

export async function call(path: any, method: any, body: any) {
  const res = await fetch(base + path, {
    method: method || "GET",
    headers: { "content-type": "application/json", "x-user-id": "demo" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch (e) {
    return txt;
  }
}

export function tasks(user: any) {
  return call("/tasks?user=" + user, "GET", null);
}

export function makeTask(user: any, title: any, priority: any) {
  return call("/tasks", "POST", { userId: user, title: title, priority: priority });
}

export function run(id: any) {
  return call("/tasks/" + id + "/run", "POST", {});
}

export function stats() {
  return call("/stats", "GET", null);
}

export function invoices() {
  return call("/invoices", "GET", null);
}

export async function allPages() {
  const out: any[] = [];
  let page = 1;
  while (true) {
    const r: any = await call("/tasks?page=" + page, "GET", null);
    if (!r || !r.length) break;
    r.forEach((x: any) => out.push(x));
    page++;
    if (page > 50) break;
  }
  return out;
}