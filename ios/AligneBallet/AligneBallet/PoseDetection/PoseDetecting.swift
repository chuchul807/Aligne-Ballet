import CoreGraphics

protocol PoseDetecting: Sendable {
    func detect(image: CGImage) async throws -> LandmarkSet
}

struct PoseLandmarkValue: Sendable {
    let x: Double
    let y: Double
    let z: Double?
    let visibility: Double?
    let presence: Double?
}
