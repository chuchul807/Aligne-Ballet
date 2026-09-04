export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function angleDeg(a: Point, vertex: Point, c: Point): number | null {
  const first = { x: a.x - vertex.x, y: a.y - vertex.y };
  const second = { x: c.x - vertex.x, y: c.y - vertex.y };
  const firstLength = Math.hypot(first.x, first.y);
  const secondLength = Math.hypot(second.x, second.y);
  if (firstLength === 0 || secondLength === 0) return null;

  const cosine = (first.x * second.x + first.y * second.y) / (firstLength * secondLength);
  return Math.acos(Math.min(1, Math.max(-1, cosine))) * (180 / Math.PI);
}

export function slopeDeg(a: Point, b: Point): number | null {
  if (a.x === b.x && a.y === b.y) return null;
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

export function normalisedDistance(a: Point, b: Point, scale: number): number | null {
  return scale > 0 ? distance(a, b) / scale : null;
}
