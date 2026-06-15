// ─────────────────────────────────────────────────────────────────────────────
// Process "plant" models — first-order physics run after the rungs each scan so
// the simulated process responds to PLC outputs over time. Pure + serialisable
// config, so the Web Worker and the grader replay identical behaviour.
// ─────────────────────────────────────────────────────────────────────────────

import type { PlantConfig, TagStore } from "./types";

function readNum(tags: TagStore, name: string | number | undefined): number {
  if (typeof name === "number") return name;
  if (name === undefined) return 0;
  const tag = tags[name];
  if (!tag) return 0;
  if (typeof tag.value === "number") return tag.value;
  if (typeof tag.value === "boolean") return tag.value ? 1 : 0;
  return 0;
}

function writeNum(tags: TagStore, name: string, val: number): void {
  const tag = tags[name];
  if (!tag) return;
  if (tag.type === "DINT") tag.value = Math.round(val);
  else if (tag.type === "REAL") tag.value = val;
}

function readBool(tags: TagStore, name: string): boolean {
  const tag = tags[name];
  return tag ? Boolean(tag.value) : false;
}

function setBoolTag(tags: TagStore, name: string, val: boolean): void {
  const tag = tags[name];
  if (tag && tag.type === "BOOL") tag.value = val;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function runPlant(
  plant: PlantConfig | undefined,
  tags: TagStore,
  dtMs: number,
): void {
  if (!plant) return;
  const sec = dtMs / 1000;
  if (sec <= 0) return;
  const p = plant.params;

  switch (plant.model) {
    case "tank": {
      // level (raw counts) rises while inlet open, falls while outlet open.
      const levelTag = String(p.level);
      const max = readNum(tags, p.max ?? 4095);
      let lvl = readNum(tags, levelTag);
      const fill = readBool(tags, String(p.inlet)) ? readNum(tags, p.fillRate) : 0;
      const drain = readBool(tags, String(p.outlet)) ? readNum(tags, p.drainRate) : 0;
      lvl = clamp(lvl + (fill - drain) * sec, 0, max);
      writeNum(tags, levelTag, lvl);
      break;
    }
    case "motor": {
      // actual rpm ramps toward commanded rpm at `accel` rpm/sec.
      const actualTag = String(p.actual);
      const target = readNum(tags, p.cmd);
      const accel = readNum(tags, p.accel);
      let act = readNum(tags, actualTag);
      const step = accel * sec;
      if (act < target) act = Math.min(target, act + step);
      else if (act > target) act = Math.max(target, act - step);
      writeNum(tags, actualTag, act);
      break;
    }
    case "garage": {
      // Door position 0 (closed) … 100 (open). MotorUp raises, MotorDown lowers
      // at `rate` %/s. The plant drives the limit-switch feedback bits.
      const posTag = String(p.pos);
      const rate = readNum(tags, p.rate);
      let pos = readNum(tags, posTag);
      const up = readBool(tags, String(p.up));
      const down = readBool(tags, String(p.down));
      if (up) pos += rate * sec;
      if (down) pos -= rate * sec;
      pos = clamp(pos, 0, 100);
      writeNum(tags, posTag, pos);
      setBoolTag(tags, String(p.upperLS), pos >= 100);
      setBoolTag(tags, String(p.lowerLS), pos <= 0);
      break;
    }
    case "conveyor": {
      // Belt position advances while Run; each `spacing` of travel past a sensor
      // emits one box (Sensor pulses true for the scan it crosses). `count` holds
      // total boxes that have passed (for display only — the program counts too).
      const run = readBool(tags, String(p.run));
      if (!run) {
        setBoolTag(tags, String(p.sensor), false);
        break;
      }
      const speed = readNum(tags, p.speed); // %/s of belt travel
      const spacing = Math.max(1, readNum(tags, p.spacing));
      const distTag = String(p.dist);
      const prev = readNum(tags, distTag);
      const next = prev + speed * sec;
      writeNum(tags, distTag, next);
      // sensor pulses once each time we cross a spacing boundary
      const crossed = Math.floor(next / spacing) > Math.floor(prev / spacing);
      setBoolTag(tags, String(p.sensor), crossed);
      break;
    }
    case "oven": {
      // First-order thermal lag. PV (°C) relaxes toward a target set by the
      // heater command (cv, 0–100 %) with time constant tau (seconds):
      //   target = ambient + gain·cv/100 ;  dT = (target − T)·(dt/tau)
      const pvTag = String(p.pv);
      const ambient = readNum(tags, p.ambient);
      const gain = readNum(tags, p.gain);
      const tau = Math.max(0.001, readNum(tags, p.tau));
      const cv = clamp(readNum(tags, p.cv), 0, 100);
      const target = ambient + (gain * cv) / 100;
      let T = readNum(tags, pvTag);
      T += (target - T) * Math.min(1, sec / tau);
      writeNum(tags, pvTag, T);
      break;
    }
  }
}
