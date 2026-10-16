import Foundation

enum AnnotationCommandBuilder {
    static let mainStructuralLandmarks: [LandmarkName] = [
        .nose, .leftEar, .rightEar,
        .leftShoulder, .rightShoulder, .leftElbow, .rightElbow, .leftWrist, .rightWrist,
        .leftHip, .rightHip, .leftKnee, .rightKnee, .leftAnkle, .rightAnkle,
        .leftHeel, .rightHeel, .leftFootIndex, .rightFootIndex,
    ]

    static let structuralSegments: [(LandmarkName, LandmarkName)] = [
        (.leftShoulder, .rightShoulder),
        (.leftShoulder, .leftElbow), (.leftElbow, .leftWrist),
        (.rightShoulder, .rightElbow), (.rightElbow, .rightWrist),
        (.leftShoulder, .leftHip), (.rightShoulder, .rightHip), (.leftHip, .rightHip),
        (.leftHip, .leftKnee), (.leftKnee, .leftAnkle),
        (.rightHip, .rightKnee), (.rightKnee, .rightAnkle),
        (.leftAnkle, .leftHeel), (.leftHeel, .leftFootIndex), (.leftAnkle, .leftFootIndex),
        (.rightAnkle, .rightHeel), (.rightHeel, .rightFootIndex), (.rightAnkle, .rightFootIndex),
    ]

    static func build(
        observations: [Observation],
        landmarks: [Landmark],
        reliability: [LandmarkName: LandmarkReliability],
        supportingSide: SupportingSide
    ) -> [DrawingCommand] {
        let available = Set(landmarks.map(\.name))
        func reliable(_ joints: [LandmarkName]) -> Bool {
            joints.allSatisfy { available.contains($0) && reliability[$0]?.assessability == .assessable }
        }

        var commands = mainStructuralLandmarks
            .filter { reliable([$0]) }
            .map { DrawingCommand.structuralJoint(joint: $0) }
        commands.append(contentsOf: structuralSegments.compactMap { from, to in
            reliable([from, to]) ? .skeletonSegment(from: from, to: to) : nil
        })

        for (index, observation) in observations.prefix(3).enumerated() {
            let label = index + 1
            let instructions = observation.annotation.isEmpty
                ? fallbackInstructions(for: observation, supportingSide: supportingSide)
                : observation.annotation
            for instruction in instructions where reliable(instruction.joints) {
                switch instruction.type {
                case .joint:
                    commands.append(contentsOf: instruction.joints.map {
                        .highlightJoint(observationID: observation.id, joint: $0, label: label)
                    })
                case .region:
                    commands.append(.highlightRegion(
                        observationID: observation.id,
                        joints: instruction.joints,
                        label: label
                    ))
                case .arrow:
                    if let anchor = instruction.joints.first {
                        commands.append(.directionArrow(
                            observationID: observation.id,
                            anchor: anchor,
                            dx: instruction.dx ?? 0,
                            dy: instruction.dy ?? -0.12,
                            label: label
                        ))
                    }
                }
            }
        }
        return commands
    }

    private static func fallbackInstructions(
        for observation: Observation,
        supportingSide: SupportingSide
    ) -> [AnnotationInstruction] {
        if observation.ruleID == "supporting-knee-bent" {
            let knee = supportingSide.landmark(.knee)
            return [
                AnnotationInstruction(
                    observationID: observation.id, type: .joint,
                    joints: [knee], dx: nil, dy: nil
                ),
                AnnotationInstruction(
                    observationID: observation.id, type: .arrow,
                    joints: [knee], dx: 0, dy: -0.12
                ),
            ]
        }
        return [AnnotationInstruction(
            observationID: observation.id,
            type: observation.evidence.count == 1 ? .joint : .region,
            joints: observation.evidence,
            dx: nil,
            dy: nil
        )]
    }
}
