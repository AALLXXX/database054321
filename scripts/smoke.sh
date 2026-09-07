#!/usr/bin/env bash
# Smoke test API lokal: bash scripts/smoke.sh http://localhost:3000
set -euo pipefail
BASE="${1:-http://localhost:3000}"
CJ="$(mktemp)"
H=(-H "Content-Type: application/json" -H "Origin: $BASE" -b "$CJ" -c "$CJ")
TOKEN="${SMOKE_TOKEN:-1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA}"
TG="${SMOKE_TG:-2098147421}"

step() { printf '\n== %s\n' "$*"; }

step "ping";            curl -sf "$BASE/api/v1/ping"; echo
step "setup owner";     curl -s "${H[@]}" -X POST "$BASE/api/auth/setup" -d '{"username":"owner","password":"OwnerPass123!","confirm":"OwnerPass123!"}'; echo
step "login owner";     curl -sf "${H[@]}" -X POST "$BASE/api/auth/login" -d '{"username":"owner","password":"OwnerPass123!"}'; echo
step "me";              curl -sf "${H[@]}" "$BASE/api/auth/me"; echo
step "create free user"; curl -s "${H[@]}" -X POST "$BASE/api/users" -d '{"username":"freeuser","password":"FreePass123!","role":"free"}'; echo
step "add bot (no verify)"; BOT=$(curl -sf "${H[@]}" -X POST "$BASE/api/bots" -d "{\"token\":\"$TOKEN\",\"telegramId\":\"$TG\",\"name\":\"Bot Smoke\",\"verify\":false}"); echo "$BOT"
BOT_ID=$(echo "$BOT" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
step "duplicate bot -> 409"; curl -s -o /dev/null -w '%{http_code}\n' "${H[@]}" -X POST "$BASE/api/bots" -d "{\"token\":\"$TOKEN\",\"telegramId\":\"$TG\",\"verify\":false}"
step "reveal";          curl -sf "${H[@]}" -X POST "$BASE/api/bots/$BOT_ID/reveal"; echo
step "create api key";  KEY=$(curl -sf "${H[@]}" -X POST "$BASE/api/keys" -d '{"name":"smoke","scopes":["read","write"]}'); echo "$KEY"
SECRET=$(echo "$KEY" | sed -n 's/.*"secret":"\([^"]*\)".*/\1/p')
step "v1 me";           curl -sf -H "Authorization: Bearer $SECRET" "$BASE/api/v1/me"; echo
step "v1 bots reveal";  curl -sf -H "Authorization: Bearer $SECRET" "$BASE/api/v1/bots?reveal=1"; echo
step "v1 get by tg id"; curl -sf -H "x-api-key: $SECRET" "$BASE/api/v1/bots/$TG"; echo
step "v1 patch";        curl -sf -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" -X PATCH "$BASE/api/v1/bots/$BOT_ID" -d '{"name":"Bot Renamed","status":"inactive"}'; echo
step "v1 bad key -> 401"; curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer adb_wrong" "$BASE/api/v1/bots"
step "csrf: wrong origin -> 403"; curl -s -o /dev/null -w '%{http_code}\n' -H "Content-Type: application/json" -H "Origin: https://evil.example" -b "$CJ" -X POST "$BASE/api/bots" -d '{}'
step "sse (2s)";        timeout 2 curl -sN -H "Authorization: Bearer $SECRET" "$BASE/api/v1/stream" || true; echo
step "stats";           curl -sf "${H[@]}" "$BASE/api/stats"; echo
step "audit";           curl -sf "${H[@]}" "$BASE/api/audit?limit=5" | head -c 600; echo
step "free login + limit"
FJ="$(mktemp)"; FH=(-H "Content-Type: application/json" -H "Origin: $BASE" -b "$FJ" -c "$FJ")
curl -sf "${FH[@]}" -X POST "$BASE/api/auth/login" -d '{"username":"freeuser","password":"FreePass123!"}' >/dev/null
curl -s "${FH[@]}" -X POST "$BASE/api/bots" -d '{"token":"2222222222:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB","telegramId":"11111111","verify":false}'; echo
step "free 2nd bot -> 403 limit"; curl -s -w '\n%{http_code}\n' "${FH[@]}" -X POST "$BASE/api/bots" -d '{"token":"3333333333:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC","telegramId":"11111111","verify":false}'
step "free cannot list users -> 403"; curl -s -o /dev/null -w '%{http_code}\n' "${FH[@]}" "$BASE/api/users"
step "lockout: 5 wrong passwords"
for i in 1 2 3 4 5; do curl -s -o /dev/null -w '%{http_code} ' "${FH[@]}" -X POST "$BASE/api/auth/login" -d '{"username":"freeuser","password":"wrong"}'; done; echo
step "correct password while locked -> locked"; curl -s "${FH[@]}" -X POST "$BASE/api/auth/login" -d '{"username":"freeuser","password":"FreePass123!"}'; echo
step "delete bot";      curl -sf "${H[@]}" -X DELETE "$BASE/api/bots/$BOT_ID"; echo
step "logout";          curl -sf "${H[@]}" -X POST "$BASE/api/auth/logout"; echo
echo; echo "SMOKE OK"
