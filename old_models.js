var db = require("./legacy-scripts/do_everything");

function Task(o) {
  this.id = o.id;
  this.title = o.title;
  this.status = o.status || "pending";
  this.priority = o.priority || "normal";
  this.userId = o.userId;
}

Task.prototype.save = function () {
  return db.createTask(this.userId, this.title, this.priority);
};

Task.prototype.run = function () {
  return db.runTask(this.id);
};

function User(o) {
  this.id = o.id;
  this.email = o.email;
  this.name = o.displayName || o.name;
}

User.prototype.tasks = function () {
  return db.getTasks(this.id);
};

function Invoice(items, code) {
  this.items = items;
  this.code = code;
  this.total = db.invoiceDiscount(db.invoiceTotal(items), code);
}

module.exports = { Task: Task, User: User, Invoice: Invoice };