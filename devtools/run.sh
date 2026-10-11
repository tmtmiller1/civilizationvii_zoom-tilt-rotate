#!/bin/zsh
# Runs one test in the running game and prints its results.
#
#   devtools/run.sh devtools/full-range.js
#
# Needs the game running with its UI debugger on port 9444, and Tower Bench beside this repo at
# ../../tools/tower-bench. The test runs inside an async function after lib.js; the recorded trackpad
# gesture is available to it as `recordedGesture`.

test_file=${1:A}
here=${0:A:h}
cd "$here/../../../tools/tower-bench" || exit 1

body="$(cat "$here/lib.js")
const recordedGesture = $(cat "$here/gesture-zoom-in.json");
$(cat "$test_file")"

node tower-bench.mjs eval "(window.__testResult = 'running', (async () => {
$body
window.__testResult = JSON.stringify(results);
})().catch((error) => { window.__testResult = 'ERROR ' + error; }), 'started')" > /dev/null

for attempt in $(seq 1 60); do
  sleep 4
  result=$(node tower-bench.mjs eval 'window.__testResult')
  if [ "$result" != "running" ]; then
    echo "$result"
    exit 0
  fi
done
echo "timed out" >&2
exit 1
