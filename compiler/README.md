# @omnilet/compiler

Table-driven mini-app compiler (D5). Slice-1 target: WeChat.

## Registry / connectivity probe (Task 0, measured 2026-10-21)

`pixi run pnpm install --dir compiler` resolved all deps against the default
registry (`https://registry.npmjs.org/`, no `.npmrc`, no mirror) through the
system proxy (`http_proxy=10.144.0.1:7897`) — 4-7s per add, zero retries.
The proxy route is the measured working path; a domestic mirror is deferred
to a later slice (spec §7).
