var fs = require("fs");
var db = require("./do_everything");

async function go() {
  var tasks = await db.getTasks();
  var csv = "id,title,status,priority\n";
  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    csv += t.id + "," + t.title.replace(/,/g, " ") + "," + t.status + "," + t.priority + "\n";
  }
  fs.writeFileSync("export_final.csv", csv);
  console.log("done " + tasks.length);
}

function go2(user) {
  return db.getTasks(user).then(function (tasks) {
    var csv = "id,title\n";
    tasks.forEach(function (t) {
      csv += t.id + "," + t.title + "\n";
    });
    fs.writeFileSync("export_user.csv", csv);
    return tasks.length;
  });
}

module.exports = { go: go, go2: go2 };

if (require.main === module) {
  go();
}