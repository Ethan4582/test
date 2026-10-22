const fetch = require("node-fetch");
var API = "https://api.internal.taskflow.local";
var TOKEN = process.env.TOKEN;

function get(u) {
  return fetch(API + u, { headers: { auth: TOKEN } }).then(function (r) {
    return r.json();
  });
}

function post(u, b) {
  return fetch(API + u, {
    method: "POST",
    headers: { auth: TOKEN, "content-type": "application/json" },
    body: JSON.stringify(b),
  }).then(function (r) {
    return r.json();
  });
}

function del(u) {
  return fetch(API + u, { method: "DELETE", headers: { auth: TOKEN } });
}

function log(x) {
  console.log(new Date().toISOString(), x);
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function chunk(arr, n) {
  var out = [];
  for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function pick(o, keys) {
  var r = {};
  keys.forEach(function (k) {
    if (o[k] !== undefined) r[k] = o[k];
  });
  return r;
}

module.exports = { get: get, post: post, del: del, log: log, sleep: sleep, chunk: chunk, pick: pick };