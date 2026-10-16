import Foundation

enum Geometry {
    struct Point: Codable, Equatable, Sendable {
        let x: Double
        let y: Double
    }

    static func distance(_ a: Point, _ b: Point) -> Double? {
        guard isFinite(a), isFinite(b) else { return nil }
        return hypot(b.x - a.x, b.y - a.y)
    }

    static func midpoint(_ a: Point, _ b: Point) -> Point? {
        guard isFinite(a), isFinite(b) else { return nil }
        return Point(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
    }

    static func angleDegrees(_ a: Point, vertex: Point, _ b: Point) -> Double? {
        guard isFinite(a), isFinite(vertex), isFinite(b) else { return nil }

        let first = Point(x: a.x - vertex.x, y: a.y - vertex.y)
        let second = Point(x: b.x - vertex.x, y: b.y - vertex.y)
        let firstLength = hypot(first.x, first.y)
        let secondLength = hypot(second.x, second.y)
        guard firstLength != 0, secondLength != 0 else { return nil }

        let cosine = (first.x * second.x + first.y * second.y) / (firstLength * secondLength)
        return acos(min(1, max(-1, cosine))) * (180 / .pi)
    }

    static func slopeDegrees(_ a: Point, _ b: Point) -> Double? {
        guard isFinite(a), isFinite(b) else { return nil }
        guard a.x != b.x || a.y != b.y else { return nil }

        let directed = atan2(b.y - a.y, b.x - a.x) * (180 / .pi)
        if directed > 90 { return directed - 180 }
        if directed <= -90 { return directed + 180 }
        return directed
    }

    static func normalizedDistance(_ a: Point, _ b: Point, scale: Double) -> Double? {
        guard let measured = distance(a, b), scale.isFinite, scale > 0 else { return nil }
        return measured / scale
    }

    private static func isFinite(_ point: Point) -> Bool {
        point.x.isFinite && point.y.isFinite
    }
}
