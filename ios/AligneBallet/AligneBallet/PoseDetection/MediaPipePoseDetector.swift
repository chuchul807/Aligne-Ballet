import CoreGraphics
import Foundation
import MediaPipeTasksVision
import UIKit

private final class DetectionCancellationFlag: @unchecked Sendable {
    private let lock = NSLock()
    private var cancelled = false

    func cancel() {
        lock.lock()
        cancelled = true
        lock.unlock()
    }

    var isCancelled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return cancelled
    }
}

final class MediaPipePoseDetector: PoseDetecting, @unchecked Sendable {
    private let queue = DispatchQueue(label: "online.aligneballet.pose-detection", qos: .userInitiated)
    private let landmarker: PoseLandmarker

    init(modelURL: URL) throws {
        let options = PoseLandmarkerOptions()
        options.baseOptions.modelAssetPath = modelURL.path
        options.runningMode = .image
        options.numPoses = 2
        options.minPoseDetectionConfidence = 0.5
        options.minPosePresenceConfidence = 0.5
        landmarker = try PoseLandmarker(options: options)
    }

    func detect(image: CGImage) async throws -> LandmarkSet {
        try Task.checkCancellation()
        let cancellation = DetectionCancellationFlag()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                queue.async {
                    do {
                        guard !cancellation.isCancelled else { throw CancellationError() }
                        let mediaImage = try MPImage(uiImage: UIImage(cgImage: image))
                        guard !cancellation.isCancelled else { throw CancellationError() }
                        let result = try self.landmarker.detect(image: mediaImage)
                        guard !cancellation.isCancelled else { throw CancellationError() }
                        let people = result.landmarks.map { pose in
                            pose.map { point in
                                PoseLandmarkValue(
                                    x: Double(point.x), y: Double(point.y), z: Double(point.z),
                                    visibility: point.visibility?.doubleValue,
                                    presence: point.presence?.doubleValue
                                )
                            }
                        }
                        continuation.resume(returning: Self.mapPeople(
                            people, width: image.width, height: image.height
                        ))
                    } catch {
                        continuation.resume(throwing: error)
                    }
                }
            }
        } onCancel: {
            cancellation.cancel()
        }
    }

    static func mapPeople(
        _ people: [[PoseLandmarkValue]], width: Int, height: Int
    ) -> LandmarkSet {
        let names = LandmarkName.allCases
        return LandmarkSet(
            people: people.map { pose in
                pose.prefix(names.count).enumerated().map { index, point in
                    Landmark(
                        name: names[index], x: point.x, y: point.y, z: point.z,
                        visibility: point.visibility ?? 0, presence: point.presence
                    )
                }
            },
            sourceWidth: width,
            sourceHeight: height
        )
    }
}
