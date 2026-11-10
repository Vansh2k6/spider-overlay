import { WET } from "../../config/wet.js";
import { SILK, WEB } from "../../config/fx.js";
import type { Anchor, Anchors } from "./anchors.js";
import { createContact, findContact, touchesAnchor } from "./contact.js";
import type { Contact } from "./contact.js";
import { pinRope, pinRopeEnd, releaseRope, requestRope } from "./rope.js";
import type { Ropes } from "./rope.js";

export function createWeb(r: Ropes, anchors: Anchors) {
  const from: (Anchor | null)[] = Array(r.slots).fill(null);
  const to: (Anchor | null)[] = Array(r.slots).fill(null);
  const au = new Float64Array(r.slots), av = new Float64Array(r.slots);
  const bu = new Float64Array(r.slots), bv = new Float64Array(r.slots), born = new Float64Array(r.slots);
  const root = createContact(), hit = createContact();
  let previousX = 0, previousY = 0, ready = false, blockedUntilMove = -Infinity;
  const state = { count: 0, spawned: 0, released: 0, contacts: 0,
    liveSlot: -1, capacityReached: false };

  function count() {
    state.count = 0;
    for (let s = 0; s < r.slots; s++) if (r.state[s] && r.kind[s]) state.count++;
    // A clear can briefly leave every slot fading while fresh crossings arrive.
    if (state.count < WEB.maxStrands) state.capacityReached = false;
  }
  function copyContact(target: Contact, source: Contact) {
    target.anchor = source.anchor; target.x = source.x; target.y = source.y;
    target.u = source.u; target.v = source.v;
  }
  function length(slot: number, x: number, y: number) {
    const start = slot * SILK.nodesPerRope;
    const distance = Math.hypot(x - r.x[start], y - r.y[start]);
    return Math.max(WEB.minLength, distance + Math.min(WEB.maxSlack, distance * (WEB.slack - 1)))
      / (SILK.nodesPerRope - 1);
  }
  function mesh(slot: number, x: number, y: number) {
    const start = slot * SILK.nodesPerRope, ax = r.x[start], ay = r.y[start];
    const sag = Math.min(WEB.maxSlack, Math.hypot(x - ax, y - ay) * WEB.sagFraction);
    for (let i = 1; i < SILK.nodesPerRope; i++) {
      const n = start + i, t = i / (SILK.nodesPerRope - 1);
      r.x[n] = r.px[n] = ax + (x - ax) * t;
      r.y[n] = r.py[n] = ay + (y - ay) * t + Math.sin(t * Math.PI) * sag;
    }
  }
  function start(x: number, y: number, time: number) {
    if (!root.anchor || state.liveSlot >= 0) return;
    count();
    // Preserve existing silk at capacity; only an explicit clear frees its slots.
    if (state.count >= WEB.maxStrands) { state.capacityReached = true; return; }
    const ax = root.anchor.left + root.anchor.width * root.u;
    const ay = root.anchor.top + root.anchor.height * root.v;
    const slot = requestRope(r, ax, ay, 0);
    if (slot < 0) return;
    from[slot] = root.anchor; to[slot] = null;
    au[slot] = root.u; av[slot] = root.v; born[slot] = time;
    r.kind[slot] = 2; r.pins[slot] = 3;
    r.rest[slot] = length(slot, x, y);
    mesh(slot, x, y); pinRopeEnd(r, slot, x, y);
    const last = ((slot + 1) * SILK.nodesPerRope - 1) * 2;
    r.fiber[last] = r.fiber[last + 1] = 0;
    state.liveSlot = slot; state.spawned++; count();
  }
  function contact(point: Contact, time: number) {
    count();
    if (point.anchor) point.anchor.threadTouching = true;
    // Choose a free edge pin only after a real swept intersection has been found.
    const a = point.anchor;
    if (a?.segmentX !== undefined) {
      const sx = a.endX! - a.segmentX, sy = a.endY! - a.segmentY!;
      const length = Math.hypot(sx, sy);
      const origin = Math.hypot(point.x-a.segmentX,point.y-a.segmentY!) / length;
      for (let n = 0; n < r.slots * 2; n++) {
        const at = origin + Math.ceil(n/2) * (n%2 ? 1 : -1) * WET.fanSpacing / length;
        if (at < 0 || at > 1) continue;
        const x = a.segmentX + sx * at, y = a.segmentY! + sy * at;
        const u = (x-a.left)/a.width, v=(y-a.top)/a.height;
        let free = true;
        for(let s=0;s<r.slots && free;s++) if(r.state[s]===1) {
          if ((from[s]===a && Math.hypot((au[s]-u)*a.width,(av[s]-v)*a.height)<WET.fanSpacing)
            || (to[s]===a && Math.hypot((bu[s]-u)*a.width,(bv[s]-v)*a.height)<WET.fanSpacing)) free=false;
        }
        if(free){point.u=u;point.v=v;break;}
      }
    } else if (a?.mask) {
      let best = Infinity, bestU = point.u, bestV = point.v;
      const originalU = point.u, originalV = point.v;
      const edges = a.mask.edges;
      for (let i = 0; i < edges.length; i += 2) {
        const u = edges[i], v = edges[i+1];
        const distance = Math.hypot((u-originalU)*a.width,(v-originalV)*a.height);
        if (distance >= best) continue;
        let free = true;
        for (let s = 0; s < r.slots && free; s++) {
          if (r.state[s] !== 1) continue;
          if ((from[s] === a && Math.hypot((au[s]-u)*a.width,(av[s]-v)*a.height) < WET.fanSpacing)
            || (to[s] === a && Math.hypot((bu[s]-u)*a.width,(bv[s]-v)*a.height) < WET.fanSpacing)) free = false;
        }
        if (free) { best = distance; bestU = u; bestV = v; }
      }
      if (best < Infinity) { point.u = bestU; point.v = bestV; }
    } else if (a) {
      const horizontal = Math.min(Math.abs(point.y - a.top), Math.abs(point.y - a.top - a.height))
        <= Math.min(Math.abs(point.x - a.left), Math.abs(point.x - a.left - a.width));
      const size = horizontal ? a.width : a.height;
      const origin = horizontal ? point.u : point.v;
      const spacing = a.center ? 1 / (2 * r.slots) : Math.min(WET.fanSpacing / size, 1 / 2);
      for (let attempt = 0; attempt < r.slots * 2; attempt++) {
        const offset = Math.ceil(attempt / 2) * (attempt % 2 ? 1 : -1);
        const value = origin + offset * spacing;
        if (value < 0 || value > 1) continue;
        let free = true;
        for (let s = 0; s < r.slots && free; s++) {
          if (r.state[s] !== 1) continue;
          const u = horizontal ? value : point.u, v = horizontal ? point.v : value;
          if ((from[s] === a && Math.abs(au[s] - u) < spacing / 2 && Math.abs(av[s] - v) < spacing / 2)
            || (to[s] === a && Math.abs(bu[s] - u) < spacing / 2 && Math.abs(bv[s] - v) < spacing / 2)) free = false;
        }
        if (free) { if (horizontal) point.u = value; else point.v = value; break; }
      }
    }
    if (a) { point.x = a.left + a.width * point.u; point.y = a.top + a.height * point.v; }
    const slot = state.liveSlot;
    if (slot >= 0) {
      to[slot] = point.anchor; bu[slot] = point.u; bv[slot] = point.v;
      r.kind[slot] = 1; born[slot] = time;
      r.rest[slot] = Math.max(r.rest[slot], length(slot, point.x, point.y));
      pinRopeEnd(r, slot, point.x, point.y);
      state.liveSlot = -1;
    }
    copyContact(root, point); state.contacts++;
  }
  function clear(moveAt: number) {
    for (let s = 0; s < r.slots; s++) if (r.state[s]) {
      releaseRope(r, s); from[s] = to[s] = null;
    }
    root.anchor = null; state.liveSlot = -1; state.capacityReached = false;
    for (const anchor of anchors.entries) anchor.threadTouching = false;
    ready = false; blockedUntilMove = moveAt;
  }
  function resetSweep() { ready = false; }
  function begin(anchor: Anchor, x: number, y: number, time: number) {
    root.anchor = anchor; root.u = root.v = 0;
    root.x = anchor.left; root.y = anchor.top;
    start(x, y, time);
  }
  function threadContact(x: number, y: number) {
    const slot = state.liveSlot;
    if (slot < 0) return false;
    const first = slot * SILK.nodesPerRope, end = first + SILK.nodesPerRope - 1;
    for (let n = first; n < end; n++) {
      if (findContact(anchors, r.x[n], r.y[n], n + 1 === end ? x : r.x[n + 1],
        n + 1 === end ? y : r.y[n + 1], root.anchor, hit, true)) return true;
    }
    return false;
  }
  function markThreadContacts(x: number, y: number) {
    for (const a of anchors.entries) a.threadTouching = a === root.anchor;
    const slot = state.liveSlot;
    if (slot < 0) return;
    const first = slot * SILK.nodesPerRope, end = first + SILK.nodesPerRope - 1;
    // Latch sustained intersections so an already-touching thread cannot keep spawning.
    // Each discovered anchor is excluded on subsequent scans of this same polyline.
    for (let n = first; n < end; n++) {
      for (let scan = 0; scan < anchors.entries.length; scan++) {
        if (!findContact(anchors, r.x[n], r.y[n], n + 1 === end ? x : r.x[n + 1],
          n + 1 === end ? y : r.y[n + 1], root.anchor, hit, true)) break;
        if (hit.anchor) hit.anchor.threadTouching = true;
      }
    }
  }
  function step(time: number, x: number, y: number, active: boolean, moveAt: number) {
    for (let s = 0; s < r.slots; s++) {
      if (!r.state[s] || !r.kind[s] || r.state[s] === 2) { from[s] = to[s] = null; continue; }
      const a = from[s], b = to[s];
      if (r.kind[s] === 1 && time - born[s] >= WEB.expiry) {
        releaseRope(r, s); from[s] = to[s] = null; state.released++;
        if (s === state.liveSlot) { state.liveSlot = -1; root.anchor = null; }
        continue;
      }
      if (a) pinRope(r, s, a.left + a.width * au[s], a.top + a.height * av[s]);
      if (b) {
        const bx = b.left + b.width * bu[s], by = b.top + b.height * bv[s];
        r.rest[s] = Math.max(r.rest[s], length(s, bx, by));
        pinRopeEnd(r, s, bx, by);
      }
    }
    count();
    if (ready && active && moveAt > blockedUntilMove && !state.capacityReached) {
      let ax = previousX, ay = previousY;
      // Ignore only the contact we're leaving, not every future visit to that anchor.
      let ignore = root.anchor && touchesAnchor(root.anchor, ax, ay) ? root.anchor : null;
      for (let sweep = 0; sweep < WEB.sweepLimit; sweep++) {
        if (!findContact(anchors, ax, ay, x, y, ignore, hit)) break;
        contact(hit, time);
        start(hit.x, hit.y, time);
        ax = hit.x; ay = hit.y;
        ignore = hit.anchor;
        if (state.capacityReached) break;
      }
    }
    start(x, y, time);
    const live = state.liveSlot;
    if (live >= 0) {
      const rest = Math.max(r.rest[live], length(live, x, y)), ratio = rest / r.rest[live];
      if (ratio > WEB.remeshMax) mesh(live, x, y);
      r.rest[live] = rest; pinRopeEnd(r, live, x, y);
    }
    // A visible outgoing thread can cross a word before the spinneret reaches it.
    // Consume crossings in order along that thread; the root itself cannot retrigger.
    if (ready && active && moveAt > blockedUntilMove && !state.capacityReached
      && Math.hypot(x - previousX, y - previousY) > WEB.contactEpsilon) {
      for (let sweep = 0; sweep < WEB.sweepLimit && threadContact(x, y); sweep++) {
        contact(hit, time); start(x, y, time);
        if (state.capacityReached) break;
      }
    }
    count();
    if (ready && active && (x !== previousX || y !== previousY)) markThreadContacts(x, y);
    previousX = x; previousY = y; ready = true;
  }
  return { count, step, clear, resetSweep, begin, state };
}
