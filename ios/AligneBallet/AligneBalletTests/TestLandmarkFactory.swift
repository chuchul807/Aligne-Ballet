import Foundation
@testable import AligneBallet

enum TestLandmarkFactory {
    private static let coordinates: [LandmarkName: (Double, Double)] = [
        .nose: (0.5, 0.1),
        .leftShoulder: (0.4, 0.3), .rightShoulder: (0.6, 0.3),
        .leftElbow: (0.3, 0.38), .rightElbow: (0.7, 0.38),
        .leftWrist: (0.2, 0.46), .rightWrist: (0.8, 0.46),
        .leftHip: (0.4, 0.7), .rightHip: (0.6, 0.7),
        .leftKnee: (0.4, 0.85), .rightKnee: (0.6, 0.85),
        .leftAnkle: (0.4, 0.95), .rightAnkle: (0.6, 0.95),
        .leftHeel: (0.38, 0.96), .rightHeel: (0.62, 0.96),
        .leftFootIndex: (0.36, 0.94), .rightFootIndex: (0.64, 0.94),
        .leftEar: (0.46, 0.12), .rightEar: (0.54, 0.12),
    ]

    static func person() -> [Landmark] {
        LandmarkName.allCases.map { name in
            let coordinate = coordinates[name] ?? (0.5, 0.5)
            return Landmark(name: name, x: coordinate.0, y: coordinate.1, visibility: 0.9)
        }
    }

    static func update(
        _ landmarks: [Landmark],
        _ name: LandmarkName,
        x: Double? = nil,
        y: Double? = nil,
        z: Double?? = nil,
        visibility: Double? = nil,
        presence: Double?? = nil
    ) -> [Landmark] {
        landmarks.map { point in
            guard point.name == name else { return point }
            return Landmark(
                name: point.name,
                x: x ?? point.x,
                y: y ?? point.y,
                z: z ?? point.z,
                visibility: visibility ?? point.visibility,
                presence: presence ?? point.presence
            )
        }
    }
}
