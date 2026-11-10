import { WEB } from "../../config/fx.js";
import type { Anchor, Anchors } from "./anchors.js";

export function createContact() {
  return { anchor: null as Anchor | null, t: Infinity, x: 0, y: 0, u: 0, v: 0 };
}
export type Contact = ReturnType<typeof createContact>;

export function touchesAnchor(a: Anchor, x: number, y: number) {
  const left = a.center ? a.left + a.width / 2 - WEB.pointRadius : a.left;
  const top = a.center ? a.top + a.height / 2 - WEB.pointRadius : a.top;
  const width = a.center ? WEB.pointRadius * 2 : a.width;
  const height = a.center ? WEB.pointRadius * 2 : a.height;
  return x >= left - WEB.contactEpsilon && x <= left + width + WEB.contactEpsilon
    && y >= top - WEB.contactEpsilon && y <= top + height + WEB.contactEpsilon;
}

// Swept contact prevents a fast pass from jumping over a thin heading or nav item.
export function findContact(anchors: Anchors, ax: number, ay: number, bx: number, by: number,
  ignore: Anchor | null, hit: Contact, freshThreadOnly = false) {
  hit.anchor = null; hit.t = Infinity;
  const dx = bx - ax, dy = by - ay;
  if (Math.hypot(dx, dy) <= WEB.contactEpsilon) return false;
  for (const a of anchors.entries) {
    if (!a.alive || a === ignore || (freshThreadOnly && a.threadTouching)) continue;
    if (a.segmentX !== undefined) {
      const sx = a.endX! - a.segmentX, sy = a.endY! - a.segmentY!;
      const cross = dx * sy - dy * sx;
      if (Math.abs(cross) <= WEB.contactEpsilon) continue;
      const rx = a.segmentX - ax, ry = a.segmentY! - ay;
      const t = (rx * sy - ry * sx) / cross, u = (rx * dy - ry * dx) / cross;
      if (t <= WEB.contactEpsilon || t > 1 || t >= hit.t || u < 0 || u > 1) continue;
      hit.anchor = a; hit.t = t; hit.x = ax + dx * t; hit.y = ay + dy * t;
      hit.u = (hit.x - a.left) / a.width; hit.v = (hit.y - a.top) / a.height;
      continue;
    }
    let enter = -Infinity, exit = Infinity;
    const left = a.center ? a.left + a.width / 2 - WEB.pointRadius : a.left;
    const right = a.center ? left + WEB.pointRadius * 2 : a.left + a.width;
    const top = a.center ? a.top + a.height / 2 - WEB.pointRadius : a.top;
    const bottom = a.center ? top + WEB.pointRadius * 2 : a.top + a.height;
    if (Math.max(ax, bx) < left || Math.min(ax, bx) > right || Math.max(ay, by) < top || Math.min(ay, by) > bottom) continue;
    if (Math.abs(dx) <= WEB.contactEpsilon) { if (ax < left || ax > right) continue; }
    else {
      const t1 = (left - ax) / dx, t2 = (right - ax) / dx;
      enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
    }
    if (Math.abs(dy) <= WEB.contactEpsilon) { if (ay < top || ay > bottom) continue; }
    else {
      const t1 = (top - ay) / dy, t2 = (bottom - ay) / dy;
      enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
    }
    let t = enter > WEB.contactEpsilon ? enter : exit;
    if (a.mask) {
      const m = a.mask;
      const first = Math.max(0, enter), last = Math.min(1, exit, hit.t);
      const steps = Math.max(1, Math.ceil((last - first) * Math.hypot(dx,dy) * 2));
      let found = false, wasSolid = false;
      for (let i = 0; i <= steps && first <= last; i++) {
        const at = first + (last - first) * i / steps;
        const x = Math.floor((ax + dx * at - a.left) * m.width / a.width);
        const y = Math.floor((ay + dy * at - a.top) * m.height / a.height);
        const solid = x >= 0 && y >= 0 && x < m.width && y < m.height && m.pixels[(y*m.width+x)*4+3] >= 128;
        if (at > WEB.contactEpsilon && (solid !== wasSolid || (i === 0 && solid))) { t = at; found = true; break; }
        wasSolid = solid;
      }
      if (!found) continue;
    }
    if (enter > exit || t <= WEB.contactEpsilon || t > 1 || t >= hit.t) continue;
    hit.anchor = a; hit.t = t; hit.x = ax + dx * t; hit.y = ay + dy * t;
    hit.u = (hit.x - a.left) / a.width; hit.v = (hit.y - a.top) / a.height;
  }
  return hit.anchor !== null;
}
