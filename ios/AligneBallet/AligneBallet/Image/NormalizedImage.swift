import CoreGraphics
import Foundation
import ImageIO

let MIN_IMAGE_SIDE = 480
let MAX_ANALYSIS_SIDE = 4096

struct NormalizedImage {
    let cgImage: CGImage
    let originalSize: PixelSize
    let wasResized: Bool
}

struct ImageMetrics: Codable, Equatable, Sendable {
    let meanLuminance: Double
    let contrast: Double
    let edgeEnergy: Double
}

enum ImageInputErrorCode: String, Equatable, Sendable {
    case unsupportedType
    case fileTooLarge
    case imageTooSmall
    case normalisationFailed
    case imageMemoryFailed
    case decodeFailed
}

struct ImageInputError: Error, Equatable, Sendable {
    let code: ImageInputErrorCode
    let localizedKey: String

    static let unsupportedType = ImageInputError(
        code: .unsupportedType,
        localizedKey: "image.error.unsupported-type"
    )
    static let fileTooLarge = ImageInputError(
        code: .fileTooLarge,
        localizedKey: "image.error.file-too-large"
    )
    static let imageTooSmall = ImageInputError(
        code: .imageTooSmall,
        localizedKey: "image.error.too-small"
    )
    static let normalisationFailed = ImageInputError(
        code: .normalisationFailed,
        localizedKey: "image.error.normalisation"
    )
    static let imageMemoryFailed = ImageInputError(
        code: .imageMemoryFailed,
        localizedKey: "image.error.memory"
    )
    static let decodeFailed = ImageInputError(
        code: .decodeFailed,
        localizedKey: "image.error.decode"
    )
}

enum ImageRenderError: Error {
    case allocationFailed
    case renderingFailed
}

protocol ImageNormalizingRenderer {
    func render(
        image: CGImage,
        orientation: CGImagePropertyOrientation,
        targetSize: PixelSize
    ) throws -> CGImage
}
