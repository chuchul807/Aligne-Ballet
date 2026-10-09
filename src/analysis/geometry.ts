export interface Point {
  x: number;
  y: number;
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function distance(a: Point, b: Point): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: Point, b: Point): Point | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function angleDeg(a: Point, vertex: Point, c: Point): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(vertex) || !isFinitePoint(c)) return null;
  const first = { x: a.x - vertex.x, y: a.y - vertex.y };
  const second = { x: c.x - vertex.x, y: c.y - vertex.y };
  const firstLength = Math.hypot(first.x, first.y);
  const secondLength = Math.hypot(second.x, second.y);
  if (firstLength === 0 || secondLength === 0) return null;

  const cosine = (first.x * second.x + first.y * second.y) / (firstLength * secondLength);
  return Math.acos(Math.min(1, Math.max(-1, cosine))) * (180 / Math.PI);
}

export function slopeDeg(a: Point, b: Point): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  if (a.x === b.x && a.y === b.y) return null;
  const directed = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
  return directed > 90 ? directed - 180 : directed <= -90 ? directed + 180 : directed;
}

export function normalisedDistance(a: Point, b: Point, scale: number): number | null {
  const measured = distance(a, b);
  return measured !== null && Number.isFinite(scale) && scale > 0 ? measured / scale : null;
}
