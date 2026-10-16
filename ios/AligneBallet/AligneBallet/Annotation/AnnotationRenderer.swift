import CoreGraphics
import Foundation
import UIKit

enum AnnotationRenderer {
    private static let skeleton = UIColor(red: 157 / 255, green: 102 / 255, blue: 120 / 255, alpha: 1)
    private static let structuralOutline = UIColor(red: 1, green: 248 / 255, blue: 250 / 255, alpha: 1)
    private static let correction = UIColor(red: 53 / 255, green: 16 / 255, blue: 31 / 255, alpha: 1)

    static func render(
        baseImage: CGImage,
        commands: [DrawingCommand],
        landmarks: [Landmark]
    ) throws -> UIImage {
        guard baseImage.width > 0, baseImage.height > 0 else {
            throw ImageInputError.normalisationFailed
        }
        let scale = min(1, Double(MAX_ANALYSIS_SIDE) / Double(max(baseImage.width, baseImage.height)))
        let width = max(1, Int((Double(baseImage.width) * scale).rounded()))
        let height = max(1, Int((Double(baseImage.height) * scale).rounded()))
        let size = CGSize(width: width, height: height)
        let shorterSide = CGFloat(min(width, height))
        let lineWidth = max(2, shorterSide / 512)
        let highlightRadius = max(lineWidth * 4, shorterSide / 64)
        let structuralRadius = max(2.5, shorterSide / 220)
        let pointByName = Dictionary(
            landmarks.map { point in
                (point.name, CGPoint(x: point.x * Double(width), y: (1 - point.y) * Double(height)))
            },
            uniquingKeysWith: { _, latest in latest }
        )

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let result = renderer.image { renderContext in
            let context = renderContext.cgContext
            UIImage(cgImage: baseImage).draw(in: CGRect(origin: .zero, size: size))

            for command in commands {
                guard case let .skeletonSegment(from, to) = command,
                      let start = pointByName[from], let end = pointByName[to] else { continue }
                context.setStrokeColor(skeleton.cgColor)
                context.setLineWidth(lineWidth)
                context.move(to: start)
                context.addLine(to: end)
                context.strokePath()
            }

            for command in commands {
                guard case let .structuralJoint(joint) = command,
                      let point = pointByName[joint] else { continue }
                drawStructuralJoint(context, at: point, radius: structuralRadius)
            }

            var marked = Set<String>()
            for command in commands {
                switch command {
                case let .highlightJoint(id, joint, label):
                    guard let point = pointByName[joint], marked.insert(id).inserted else { continue }
                    drawMarker(context, at: point, radius: highlightRadius, label: label)
                case let .highlightRegion(id, joints, label):
                    let points = joints.compactMap { pointByName[$0] }
                    guard !points.isEmpty, !marked.contains(id) else { continue }
                    let centroid = CGPoint(
                        x: points.reduce(0) { $0 + $1.x } / CGFloat(points.count),
                        y: points.reduce(0) { $0 + $1.y } / CGFloat(points.count)
                    )
                    drawMarker(context, at: centroid, radius: highlightRadius, label: label)
                    marked.insert(id)
                case let .directionArrow(id, anchor, dx, dy, label):
                    guard let start = pointByName[anchor] else { continue }
                    let end = CGPoint(
                        x: start.x + dx * Double(width),
                        y: start.y - dy * Double(height)
                    )
                    drawArrow(context, from: start, to: end, lineWidth: lineWidth)
                    if marked.insert(id).inserted {
                        drawMarker(context, at: start, radius: highlightRadius, label: label)
                    }
                default:
                    continue
                }
            }
        }
        guard result.cgImage != nil else { throw ImageInputError.imageMemoryFailed }
        return result
    }

    private static func drawStructuralJoint(_ context: CGContext, at point: CGPoint, radius: CGFloat) {
        let rect = CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)
        context.saveGState()
        context.setAlpha(0.78)
        context.setFillColor(skeleton.cgColor)
        context.fillEllipse(in: rect)
        context.setStrokeColor(structuralOutline.cgColor)
        context.setLineWidth(max(1, radius / 4))
        context.strokeEllipse(in: rect)
        context.restoreGState()
    }

    private static func drawMarker(
        _ context: CGContext,
        at point: CGPoint,
        radius: CGFloat,
        label: Int
    ) {
        let rect = CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)
        context.setFillColor(correction.cgColor)
        context.fillEllipse(in: rect)
        context.setStrokeColor(correction.cgColor)
        context.setLineWidth(max(2, radius / 5))
        context.strokeEllipse(in: rect)

        let font = UIFont.boldSystemFont(ofSize: radius)
        let text = String(label) as NSString
        let textSize = text.size(withAttributes: [.font: font])
        let textRect = CGRect(
            x: point.x - textSize.width / 2,
            y: point.y - textSize.height / 2,
            width: textSize.width,
            height: textSize.height
        )
        text.draw(in: textRect, withAttributes: [
            .font: font,
            .foregroundColor: structuralOutline,
        ])
    }

    private static func drawArrow(
        _ context: CGContext,
        from start: CGPoint,
        to end: CGPoint,
        lineWidth: CGFloat
    ) {
        let angle = atan2(end.y - start.y, end.x - start.x)
        let headLength = max(lineWidth * 5, 12)
        let firstHead = CGPoint(
            x: end.x - headLength * cos(angle - .pi / 6),
            y: end.y - headLength * sin(angle - .pi / 6)
        )
        let secondHead = CGPoint(
            x: end.x - headLength * cos(angle + .pi / 6),
            y: end.y - headLength * sin(angle + .pi / 6)
        )
        context.setStrokeColor(correction.cgColor)
        context.setLineWidth(lineWidth * 1.5)
        context.move(to: start)
        context.addLine(to: end)
        context.addLine(to: firstHead)
        context.move(to: end)
        context.addLine(to: secondHead)
        context.strokePath()
    }
}
