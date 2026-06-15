# VoltRung Academy — Core Simulation Vertical Slice

A browser-based PLC learning platform. This repo currently implements the
**engineering core** from the master spec: a faithful scan-cycle engine running
in a Web Worker, an interactive 16-point I/O chassis, a live ladder editor with
green/grey power-flow highlighting, and the first Beginner-track scenarios with
JSON auto-grading.

## Run it

The app is two processes: the Vite frontend and the Express API. Start both
(two terminals), then open the frontend.

```bash
# 1 — backend (accounts + saved programs)
cd server && npm install && npm start   # http://localhost:4000

# 2 — frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api → :4000)

npm test           # grade every scenario's reference solution (vitest)
npm run typecheck  # tsc project-wide
npm run build      # production build
```

From the repo root you can also start the backend with `npm run server`.

## What's implemented

| Layer | Status |
|---|---|
| **Layer 1 — PLC CPU** (`src/engine`, `src/workers`) | Scan cycle in a Web Worker; series/parallel rung trees; XIC/XIO/ONS, OTE/OTL/OTU, TON/TOF/RTO/RES, CTU/CTD, EQU/NEQ/LES/LEQ/GRT/GEQ/LIM, ADD/SUB/MUL/DIV/**MOD/SQR/ABS/NEG**/MOV/CLR, **SCP/SCL analog scaling**, **PID** (Kp/Ki/Kd, output clamp + anti-windup); timer/counter member addressing (`T1.DN`, `C1.ACC`); **closed-loop plant models** (tank, motor, first-order thermal oven). Electrically faithful: `TOF` won't time out until first energised, `DIV`/`MOD`-by-zero and √(negative) are math faults that leave the destination unchanged. |
| **Layer 2 — I/O Chassis** (`src/components/chassis`, `src/components/sandbox/SandboxChassis.tsx`) | Section A discrete inputs + Section B discrete outputs + **Section C analog inputs** (draggable raw-counts slider) + **Section D analog outputs** (live bar/value). The Studio chassis ships **15 input devices** (NO/NC switch, NO/NC pushbutton, NO/NC limit, selector, key switch, PNP/NPN prox, float, pressure, thermostat, foot pedal, maintained NC E-stop — each with correct momentary/maintained + NO/NC electrical behaviour) and **15 output devices** (R/A/G LEDs, pilot lamp, incandescent bulb, motor, NO/NC solenoid, relay & contactor coils, buzzer, SSR, R/A/G tower stack) with device-appropriate glyphs/animation. |
| **Layer 3 — Ladder editor** (`src/components/ladder`) | Shared SVG rung renderer (`RungView`) with live continuity highlight. Supports **true nested branching** (`src/engine/ladder.ts`): OR-branches that wrap a *group* of instructions ("connect two or more rungs together"), multi-instruction branch legs, extra parallel legs, and **multiple parallel output coils** — per IEC 61131-3. Drag instructions onto trunk or branch-leg drop slots; ⎇ OR to branch an element; Shift-click two elements then “Wrap span”. Operand inspector for every instruction. Function blocks (timers, counters, compares, math, SCP/SCL) render **FBD-style with labelled input pins on the left and output pins on the right** (e.g. ADD shows A, B → Dest; timers show PRE/ACC with DN/TT outputs). Used by both the Studio sandbox and the Academy. |
| **Process widgets** (`src/components/process`) | Data-driven 2-D process graphics: tank, VFD motor, oven, **traffic-light post**, **garage door** (slides with live limit-switch lamps), and **box-counting conveyor** (belt + travelling boxes + count). All driven by the simulated process and serialisable plant models (`tank`, `motor`, `oven`, `garage`, `conveyor`). |
| **Scenario engine** (`src/scenarios`, `src/engine/grader.ts`) | JSON test specs (with timed `holdMs` steps), auto-grader, **14 scenarios**: 8 Beginner + 3 analog (tank level, VFD speed, PID oven) + 3 process (traffic-light sequence, garage door w/ limit switches, conveyor 5-box CTU count). |
| **Run control** | Start / Stop / Step / Reset, adjustable 1–500 ms scan time, live scan-exec readout, tag-watch table. |
| **Accounts + cloud save** (`server/`, `src/api`) | Express + SQLite (`node:sqlite`) backend with JWT auth (bcrypt-hashed passwords) and per-user program storage. Register / sign in, then create, save, rename, delete, import, and export PLC files — all persisted server-side so they follow the user across devices and survive a browser-cache wipe. |
| **Two-section app shell** (`Hub`, `App.tsx`) | After sign-in, a hub routes to two visually-distinct areas: **Simulation Studio** (the open-ended sandbox + cloud save) and **VoltRung Academy** (guided, auto-graded coursework — task brief, wired chassis, ladder editor, tag watch, process view). |

## Architecture

```
src/
├── engine/            framework-agnostic PLC core (unit-tested)
│   ├── types.ts       Tag / Rung / Instruction / PLCState model
│   ├── scan.ts        instruction execution + scan cycle
│   ├── grader.ts      scenario auto-grader
│   └── edit.ts        immutable ladder-edit operations
├── workers/           plcScan.worker.ts — owns state, runs the scan loop
├── scenarios/         curriculum content + reference solutions + tests
├── api/               REST client (auth token + programs)
├── store/             Zustand store wiring UI ⇄ worker ⇄ API
└── components/        chassis · ladder · watch · scenario · toolbar · sandbox

server/
├── index.js           Express app + REST routes
├── auth.js            JWT issue/verify + requireAuth middleware
└── db.js              SQLite schema + user/program queries (node:sqlite)
```

## Not yet built (next slices)

BCD/7-seg/HSC analog extras (Sections E–G), PID control block, more process
widgets (conveyor, traffic light, garage door), progress/XP tracking on the
backend, Postgres swap for production, Volta AI tutor, wiring tutor,
certification, Stripe, and the remaining curriculum items. The engine, content
model, and API are shaped to absorb these without rework.
