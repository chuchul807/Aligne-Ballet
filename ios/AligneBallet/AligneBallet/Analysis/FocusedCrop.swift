import CoreGraphics
import Foundation

let MIN_SUBJECT_VISIBILITY = 0.60
let MIN_TORSO_PIXELS = 48.0
let MIN_BODY_EXTENT_PIXELS = 180.0
let FOCUS_PADDING_RATIO = 0.20

struct CropRect: Equatable, Sendable {
    let left: Double
    let top: Double
    let width: Double
    let height: Double
}

enum SubjectSizeAssessment: Equatable, Sendable {
    case usable(torsoPixels: Double, bodyExtentPixels: Double)
    case insufficientEvidence
    case tooSmall
}

enum FocusedCrop {
    private static let required: [LandmarkName] = [
        .leftShoulder, .rightShoulder, .leftHip, .rightHip,
    ]

    static func assessSubjectSize(
        landmarks: [Landmark],
        sourceSize: PixelSize
    ) -> SubjectSizeAssessment {
        guard
            let usable = requiredEvidence(landmarks),
            sourceSize.width > 0,
            sourceSize.height > 0
        else {
            return .insufficientEvidence
        }

        let points = index(usable)
        let leftShoulder = points[.leftShoulder]!
        let rightShoulder = points[.rightShoulder]!
        let leftHip = points[.leftHip]!
        let rightHip = points[.rightHip]!
        let shoulderX = (leftShoulder.x + rightShoulder.x) / 2
        let shoulderY = (leftShoulder.y + rightShoulder.y) / 2
        let hipX = (leftHip.x + rightHip.x) / 2
        let hipY = (leftHip.y + rightHip.y) / 2
        let torsoPixels = hypot(
            (hipX - shoulderX) * Double(sourceSize.width),
            (hipY - shoulderY) * Double(sourceSize.height)
        )
        let xs = usable.map { $0.x * Double(sourceSize.width) }
        let ys = usable.map { $0.y * Double(sourceSize.height) }
        let bodyExtentPixels = max(
            (xs.max() ?? 0) - (xs.min() ?? 0),
            (ys.max() ?? 0) - (ys.min() ?? 0)
        )
        if torsoPixels < MIN_TORSO_PIXELS || bodyExtentPixels < MIN_BODY_EXTENT_PIXELS {
            return .tooSmall
        }
        return .usable(torsoPixels: torsoPixels, bodyExtentPixels: bodyExtentPixels)
    }

    static func calculateRect(
        landmarks: [Landmark],
        sourceSize: PixelSize
    ) -> CropRect? {
        guard case .usable = assessSubjectSize(landmarks: landmarks, sourceSize: sourceSize),
              let usable = requiredEvidence(landmarks) else {
            return nil
        }
        let xs = usable.map { $0.x * Double(sourceSize.width) }
        let ys = usable.map { $0.y * Double(sourceSize.height) }
        guard
            let left = xs.min(), let right = xs.max(),
            let top = ys.min(), let bottom = ys.max()
        else {
            return nil
        }
        let padX = (right - left) * FOCUS_PADDING_RATIO
        let padY = (bottom - top) * FOCUS_PADDING_RATIO
        let clampedLeft = max(0, left - padX)
        let clampedTop = max(0, top - padY)
        let clampedRight = min(Double(sourceSize.width), right + padX)
        let clampedBottom = min(Double(sourceSize.height), bottom + padY)
        return CropRect(
            left: clampedLeft,
            top: clampedTop,
            width: clampedRight - clampedLeft,
            height: clampedBottom - clampedTop
        )
    }

    static func mapLandmarks(
        _ landmarks: [Landmark],
        from rect: CropRect,
        sourceSize: PixelSize
    ) -> [Landmark] {
        landmarks.map { point in
            Landmark(
                name: point.name,
                x: (rect.left + point.x * rect.width) / Double(sourceSize.width),
                y: (rect.top + point.y * rect.height) / Double(sourceSize.height),
                z: point.z.map { $0 * rect.width / Double(sourceSize.width) },
                visibility: point.visibility,
                presence: point.presence
            )
        }
    }

    static func crop(image: CGImage, rect: CropRect) throws -> CGImage {
        guard rect.width > 0, rect.height > 0 else {
            throw ImageInputError.normalisationFailed
        }
        let imageBounds = CGRect(x: 0, y: 0, width: image.width, height: image.height)
        let requested = CGRect(x: rect.left, y: rect.top, width: rect.width, height: rect.height)
        let bounded = requested.intersection(imageBounds)
        guard !bounded.isNull, !bounded.isEmpty, let cropped = image.cropping(to: bounded) else {
            throw ImageInputError.normalisationFailed
        }

        let scale = min(1, Double(MAX_ANALYSIS_SIDE) / max(rect.width, rect.height))
        let width = max(1, Int((rect.width * scale).rounded()))
        let height = max(1, Int((rect.height * scale).rounded()))
        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                | CGBitmapInfo.byteOrder32Big.rawValue
        ) else {
            throw ImageInputError.imageMemoryFailed
        }
        context.interpolationQuality = .high
        context.draw(cropped, in: CGRect(x: 0, y: 0, width: width, height: height))
        guard let output = context.makeImage() else {
            throw ImageInputError.imageMemoryFailed
        }
        return output
    }

    private static func valid(_ point: Landmark) -> Bool {
        point.x.isFinite
            && point.y.isFinite
            && point.x >= 0 && point.x <= 1
            && point.y >= 0 && point.y <= 1
            && point.visibility.isFinite
            && point.visibility >= MIN_SUBJECT_VISIBILITY
            && (point.presence.map { $0.isFinite && $0 >= MIN_SUBJECT_VISIBILITY } ?? true)
    }

    private static func requiredEvidence(_ landmarks: [Landmark]) -> [Landmark]? {
        let usable = landmarks.filter(valid)
        let names = Set(usable.map(\.name))
        guard required.allSatisfy(names.contains),
              names.contains(.leftAnkle) || names.contains(.rightAnkle) else {
            return nil
        }
        return usable
    }

    private static func index(_ landmarks: [Landmark]) -> [LandmarkName: Landmark] {
        var result = [LandmarkName: Landmark]()
        landmarks.forEach { result[$0.name] = $0 }
        return result
    }
}
