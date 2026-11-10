export const pointer = {
  x: 0, y: 0, pointerType: "mouse", pointerId: -1,
  virtual: false, isDown: false, active: false, lastMoveAt: 0,
};

const subscribers = new Set<() => void>();
const keySubscribers = new Set<(event: KeyboardEvent) => void>();
let attached = false;
export const keyboard = { key: "", code: "", repeat: false, sequence: 0, editing: false };
export const webInput = { clearSequence: 0, hidden: false };
export function setEffectsHidden(hidden: boolean) { webInput.hidden = hidden; changed(); }
export const pounceInput = { sequence: 0, x: 0, y: 0 };
export function requestWebClear() { webInput.clearSequence++; changed(); }
function notify(callback: () => void) { callback(); }
function changed() { subscribers.forEach(notify); }

let realX = 0, realY = 0, realActive = false;

export function setVirtualPointer(x: number, y: number) {
  pointer.virtual = pointer.active = true;
  pointer.x = x; pointer.y = y;
  changed();
}

export function releaseVirtualPointer() {
  if (!pointer.virtual) return;
  pointer.virtual = false; pointer.active = realActive;
  pointer.x = realX; pointer.y = realY;
  changed();
}

function position(event: PointerEvent) {
  if (!event.isPrimary) return false;
  realX = event.clientX; realY = event.clientY; realActive = true;
  if (pointer.virtual) return false;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.pointerId = event.pointerId;
  pointer.pointerType = event.pointerType;
  pointer.lastMoveAt = performance.now();
  return true;
}

function move(event: PointerEvent) {
  if (!position(event)) return;
  pointer.active = true;
  changed();
}

function down(event: PointerEvent) {
  if (!position(event)) return;
  pointer.isDown = true;
  pointer.active = true;
  changed();
}

function up(event: PointerEvent) {
  if (!position(event)) return;
  pointer.isDown = false;
  pointer.active = true;
  changed();
}

function leave() {
  realActive = false;
  pointer.active = false;
  pointer.isDown = false;
  changed();
}

function visibility() {
  if (document.hidden) leave();
  else changed();
}

function click(event: MouseEvent) {
  // Keep native editing, keyboard activation and secondary clicks intact.
  if (pointer.virtual || event.button !== 0 || event.detail === 0 || document.hidden) return;
  if (event.target instanceof Element && event.target.closest(
    "input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
  pounceInput.x = event.clientX; pounceInput.y = event.clientY;
  pounceInput.sequence++; changed();
}

function keydown(event: KeyboardEvent) {
  keyboard.key = event.key;
  keyboard.code = event.code;
  keyboard.repeat = event.repeat;
  keyboard.sequence++;
  keyboard.editing = event.target instanceof Element
    && !!event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
  keySubscribers.forEach((callback) => callback(event));
}

function attach() {
  if (!attached) {
    attached = true;
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", leave);
    window.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", keydown);
    window.addEventListener("click", click, { passive: true });
  }
}

function detach() {
  if (subscribers.size || keySubscribers.size || !attached) return;
  attached = false;
  window.removeEventListener("pointermove", move);
  window.removeEventListener("pointerdown", down);
  window.removeEventListener("pointerup", up);
  window.removeEventListener("pointercancel", leave);
  window.removeEventListener("pointerleave", leave);
  window.removeEventListener("blur", leave);
  document.removeEventListener("visibilitychange", visibility);
  window.removeEventListener("keydown", keydown);
  window.removeEventListener("click", click);
  pointer.active = pointer.isDown = false;
}

export function subscribeInput(callback: () => void) {
  subscribers.add(callback);
  attach();
  return () => {
    subscribers.delete(callback);
    detach();
  };
}

export function subscribePointer(callback: () => void) { return subscribeInput(callback); }
export function subscribeKeyDown(callback: (event: KeyboardEvent) => void) {
  keySubscribers.add(callback);
  attach();
  return () => { keySubscribers.delete(callback); detach(); };
}
export function inputDiagnostics() {
  return { attached, subscribers: subscribers.size, keySubscribers: keySubscribers.size };
}
