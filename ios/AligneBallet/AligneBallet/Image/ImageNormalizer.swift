import CoreGraphics
import Foundation
import ImageIO
import UIKit

struct ImageNormalizer {
    private let renderer: any ImageNormalizingRenderer

    init(renderer: any ImageNormalizingRenderer = UIKitImageNormalizingRenderer()) {
        self.renderer = renderer
    }

    func normalize(data: Data) throws -> NormalizedImage {
        guard
            let source = CGImageSourceCreateWithData(data as CFData, nil),
            CGImageSourceGetCount(source) > 0,
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
        else {
            throw ImageInputError.decodeFailed
        }

        let orientation = Self.orientation(from: source)
        let orientedSize = Self.orientedSize(of: image, orientation: orientation)

        guard min(orientedSize.width, orientedSize.height) >= MIN_IMAGE_SIDE else {
            throw ImageInputError.imageTooSmall
        }

        let scale = min(1, Double(MAX_ANALYSIS_SIDE) / Double(max(orientedSize.width, orientedSize.height)))
        let targetSize = PixelSize(
            width: max(1, Int((Double(orientedSize.width) * scale).rounded())),
            height: max(1, Int((Double(orientedSize.height) * scale).rounded()))
        )
        let wasResized = scale < 1

        if orientation == .up, !wasResized {
            return NormalizedImage(
                cgImage: image,
                originalSize: orientedSize,
                wasResized: false
            )
        }

        do {
            let rendered = try renderer.render(
                image: image,
                orientation: orientation,
                targetSize: targetSize
            )
            return NormalizedImage(
                cgImage: rendered,
                originalSize: orientedSize,
                wasResized: wasResized
            )
        } catch ImageRenderError.allocationFailed {
            throw ImageInputError.imageMemoryFailed
        } catch {
            throw ImageInputError.normalisationFailed
        }
    }

    private static func orientation(from source: CGImageSource) -> CGImagePropertyOrientation {
        guard
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let rawValue = properties[kCGImagePropertyOrientation] as? NSNumber,
            let orientation = CGImagePropertyOrientation(rawValue: rawValue.uint32Value)
        else {
            return .up
        }
        return orientation
    }

    private static func orientedSize(
        of image: CGImage,
        orientation: CGImagePropertyOrientation
    ) -> PixelSize {
        switch orientation {
        case .leftMirrored, .right, .rightMirrored, .left:
            return PixelSize(width: image.height, height: image.width)
        default:
            return PixelSize(width: image.width, height: image.height)
        }
    }
}

private final class UIKitImageNormalizingRenderer: ImageNormalizingRenderer {
    func render(
        image: CGImage,
        orientation: CGImagePropertyOrientation,
        targetSize: PixelSize
    ) throws -> CGImage {
        guard targetSize.width > 0, targetSize.height > 0 else {
            throw ImageRenderError.renderingFailed
        }

        let source = UIImage(
            cgImage: image,
            scale: 1,
            orientation: orientation.uiImageOrientation
        )
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let size = CGSize(width: targetSize.width, height: targetSize.height)
        let output = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            source.draw(in: CGRect(origin: .zero, size: size))
        }

        guard let cgImage = output.cgImage else {
            throw ImageRenderError.renderingFailed
        }
        return cgImage
    }
}

private extension CGImagePropertyOrientation {
    var uiImageOrientation: UIImage.Orientation {
        switch self {
        case .up: .up
        case .upMirrored: .upMirrored
        case .down: .down
        case .downMirrored: .downMirrored
        case .leftMirrored: .leftMirrored
        case .right: .right
        case .rightMirrored: .rightMirrored
        case .left: .left
        @unknown default: .up
        }
    }
}
