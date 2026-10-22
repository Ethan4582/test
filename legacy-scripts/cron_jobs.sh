#!/bin/sh
cd /opt/taskflow
node legacy-scripts/do_everything.js queue 25 >> /var/log/taskflow-queue.log 2>&1
node legacy-scripts/do_everything.js stale 3 >> /var/log/taskflow-stale.log 2>&1
node legacy-scripts/do_everything.js sync >> /var/log/taskflow-sync.log 2>&1
node legacy-scripts/do_everything.js purge 30 >> /var/log/taskflow-purge.log 2>&1
node legacy-scripts/do_everything.js backup >> /var/log/taskflow-backup.log 2>&1
node legacy-scripts/do_everything.js archive >> /var/log/taskflow-archive.log 2>&1
node legacy-scripts/do_everything.js logs >> /var/log/taskflow-logs.log 2>&1