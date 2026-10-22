function rand(n) {
  return Math.floor(Math.random() * n);
}

function pickOne(a) {
  return a[rand(a.length)];
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}

function parseBool(v) {
  return v === true || v === "true" || v === "1" || v === 1;
}

function ago(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

function retry(fn, n) {
  let i = 0;
  function go() {
    return Promise.resolve()
      .then(fn)
      .catch(function (e) {
        i++;
        if (i >= (n || 3)) throw e;
        return new Promise(function (r) {
          setTimeout(r, i * 300);
        }).then(go);
      });
  }
  return go();
}

module.exports = { rand, pickOne, shuffle, uuid, slug, money, parseBool, ago, retry };