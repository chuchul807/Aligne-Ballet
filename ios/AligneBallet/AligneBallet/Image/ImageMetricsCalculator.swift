import CoreGraphics
import Foundation

enum ImageMetricsCalculator {
    static func calculate(image: CGImage) throws -> ImageMetrics {
        let scale = min(1, 256.0 / Double(max(image.width, image.height)))
        let width = max(1, Int((Double(image.width) * scale).rounded()))
        let height = max(1, Int((Double(image.height) * scale).rounded()))
        var bytes = [UInt8](repeating: 0, count: width * height * 4)

        let rendered = bytes.withUnsafeMutableBytes { storage -> Bool in
            guard let baseAddress = storage.baseAddress else { return false }
            guard let context = CGContext(
                data: baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                    | CGBitmapInfo.byteOrder32Big.rawValue
            ) else {
                return false
            }
            context.interpolationQuality = .high
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }

        guard rendered else {
            throw ImageInputError.imageMemoryFailed
        }

        let pixelCount = width * height
        var luminances = [Double]()
        luminances.reserveCapacity(pixelCount)
        var luminanceTotal = 0.0

        for pixelIndex in 0..<pixelCount {
            let offset = pixelIndex * 4
            let value = (
                Double(bytes[offset]) * 0.2126
                    + Double(bytes[offset + 1]) * 0.7152
                    + Double(bytes[offset + 2]) * 0.0722
            ) / 255.0
            luminances.append(value)
            luminanceTotal += value
        }

        let meanLuminance = luminanceTotal / Double(pixelCount)
        let squaredDifferenceTotal = luminances.reduce(into: 0.0) { total, value in
            total += (value - meanLuminance) * (value - meanLuminance)
        }
        let contrast = sqrt(squaredDifferenceTotal / Double(pixelCount))

        var gradients = [Double]()
        gradients.reserveCapacity(max(0, (width - 1) * height + (height - 1) * width))
        for y in 0..<height {
            for x in 0..<width {
                let index = y * width + x
                if x + 1 < width {
                    gradients.append(abs(luminances[index] - luminances[index + 1]))
                }
                if y + 1 < height {
                    gradients.append(abs(luminances[index] - luminances[index + width]))
                }
            }
        }

        gradients.sort(by: >)
        let strongestGradientCount = min(gradients.count, max(1, max(width, height) * 4))
        let edgeEnergy: Double
        if gradients.isEmpty {
            edgeEnergy = 0
        } else {
            edgeEnergy = gradients.prefix(strongestGradientCount).reduce(0, +)
                / Double(strongestGradientCount)
        }

        return ImageMetrics(
            meanLuminance: meanLuminance,
            contrast: contrast,
            edgeEnergy: edgeEnergy
        )
    }
}
