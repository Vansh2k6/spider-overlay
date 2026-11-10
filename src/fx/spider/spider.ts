import { FX } from "../../config/fx.js";

export type Spider = { x: number; y: number; vx: number; vy: number;
  pursuitVX: number; pursuitVY: number;
  heading: number; moving: boolean; ready: boolean; mode: "walk" | "rest" | "pounce" };

export function createSpider(): Spider {
  return { x: FX.initialInset, y: FX.initialInset, vx: 0, vy: 0,
    pursuitVX: 0, pursuitVY: 0,
    heading: 0, moving: false, ready: false, mode: "walk" };
}

export function placeSpider(spider: Spider, width: number, height: number) {
  if (!spider.ready) {
    spider.x = Math.min(FX.initialInset, width / 2);
    spider.y = Math.max(height - FX.initialInset, height / 2);
    spider.ready = true;
  }
  spider.x = Math.max(0, Math.min(width, spider.x));
  spider.y = Math.max(0, Math.min(height, spider.y));
}

export function stopSpider(spider: Spider) {
  spider.vx = spider.vy = 0;
  spider.pursuitVX = spider.pursuitVY = 0;
  spider.moving = false;
}

export function stepSpider(spider: Spider, targetX: number, targetY: number, active: boolean, dt: number) {
  if (!active) { stopSpider(spider); return; }
  const dx = targetX - spider.x, dy = targetY - spider.y;
  const distance = Math.hypot(dx, dy);
  const error = distance - FX.stopRadius;
  if (!spider.moving && Math.abs(error) <= FX.resumeDistance) return;
  spider.moving = true;
  // Repel as well as arrive: a pointer moved onto the body must not trap it there.
  const ux = distance > FX.directionEpsilon ? dx / distance : Math.cos(spider.heading);
  const uy = distance > FX.directionEpsilon ? dy / distance : Math.sin(spider.heading);
  const desired = Math.max(-FX.maxSpeed, Math.min(FX.maxSpeed, error * FX.followGain));
  const follow = 1 - Math.exp(-dt / FX.velocityTau);
  // Grounded legs constrain actual travel without resetting the pursuit filter every frame.
  spider.pursuitVX += (ux * desired - spider.pursuitVX) * follow;
  spider.pursuitVY += (uy * desired - spider.pursuitVY) * follow;
  spider.vx = spider.pursuitVX; spider.vy = spider.pursuitVY;
  const speed = Math.hypot(spider.vx, spider.vy);
  if (speed > FX.headingSpeed) {
    const angle = Math.atan2(spider.vy, spider.vx);
    const delta = Math.atan2(Math.sin(angle - spider.heading), Math.cos(angle - spider.heading));
    spider.heading += delta * (1 - Math.exp(-dt / FX.headingTau));
  }
  let nextX = spider.x + spider.vx * dt, nextY = spider.y + spider.vy * dt;
  const remaining = Math.hypot(targetX - nextX, targetY - nextY);
  // Clamp inward overshoot to the stand-off circle, without translating on idle frames.
  if (distance >= FX.stopRadius && remaining < FX.stopRadius) {
    nextX = targetX - ux * FX.stopRadius;
    nextY = targetY - uy * FX.stopRadius;
    stopSpider(spider);
  } else if (Math.abs(error) < FX.settleDistance && speed < FX.settleSpeed) {
    stopSpider(spider);
  }
  spider.x = nextX;
  spider.y = nextY;
}
