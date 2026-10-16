import XCTest
@testable import AligneBallet

final class AnalysisPipelineTests: XCTestCase {
    actor PausingFirstDetector: PoseDetecting {
        let first: LandmarkSet
        private var callCount = 0
        private var pending: CheckedContinuation<LandmarkSet, Error>?
        private var started: CheckedContinuation<Void, Never>?

        init(_ first: LandmarkSet) { self.first = first }

        func detect(image: CGImage) async throws -> LandmarkSet {
            callCount += 1
            if callCount > 1 { return first }
            return try await withCheckedThrowingContinuation { continuation in
                pending = continuation
                started?.resume()
                started = nil
            }
        }

        func waitForFirstPass() async {
            if callCount > 0 { return }
            await withCheckedContinuation { started = $0 }
        }

        func releaseFirstPass() {
            pending?.resume(returning: first)
            pending = nil
        }

        func calls() -> Int { callCount }
    }

    actor FakeDetector: PoseDetecting {
        private let results: [LandmarkSet]
        private let failAtCall: Int?
        private var call = 0

        init(_ results: [LandmarkSet], failAtCall: Int? = nil) {
            self.results = results
            self.failAtCall = failAtCall
        }

        func detect(image: CGImage) async throws -> LandmarkSet {
            defer { call += 1 }
            if call == failAtCall { throw AnalysisError.detectionFailed }
            return results[min(call, results.count - 1)]
        }

        func calls() -> Int { call }
    }

    private static let patternedPhoto = TestImageFactory.encoded(TestImageFactory.image(
        width: 600, height: 800
    ) { x, y in
        let value: UInt8 = (x / 16 + y / 16).isMultiple(of: 2) ? 35 : 220
        return (value, value, value, 255)
    })

    private func request(_ data: Data? = nil) -> AnalysisRequest {
        AnalysisRequest(imageData: data ?? Self.patternedPhoto, position: .arabesque,
                        supportingSide: .left, expectedView: .threeQuarterSide)
    }

    private func whole(_ people: [[Landmark]]) -> LandmarkSet {
        LandmarkSet(people: people, sourceWidth: 600, sourceHeight: 800)
    }

    private func refinedPerson(_ wholePerson: [Landmark]) -> [Landmark] {
        let rect = FocusedCrop.calculateRect(
            landmarks: wholePerson, sourceSize: PixelSize(width: 600, height: 800)
        )!
        return wholePerson.map { point in
            Landmark(
                name: point.name,
                x: (point.x * 600 - rect.left) / rect.width,
                y: (point.y * 800 - rect.top) / rect.height,
                z: point.z,
                visibility: point.visibility,
                presence: point.presence
            )
        }
    }

    func testZeroPeopleRetakesWithoutCropPass() async {
        let empty = LandmarkSet(people: [], sourceWidth: 600, sourceHeight: 800)
        let detector = FakeDetector([empty])
        let pipeline = AnalysisPipeline(detector: detector)
        let photo = TestImageFactory.encoded(TestImageFactory.solid(width: 600, height: 800))
        let outcome = await pipeline.analyze(AnalysisRequest(
            imageData: photo, position: .arabesque, supportingSide: .left,
            expectedView: .threeQuarterSide
        ))
        guard case let .retake(report) = outcome else { return XCTFail("Expected retake") }
        XCTAssertTrue(report.reasons.contains { $0.code == .noPerson })
        let calls = await detector.calls()
        XCTAssertEqual(calls, 1)
    }

    func testInvalidImageRetakesWithStableReason() async {
        let detector = FakeDetector([LandmarkSet(people: [], sourceWidth: 1, sourceHeight: 1)])
        let outcome = await AnalysisPipeline(detector: detector).analyze(AnalysisRequest(
            imageData: Data([0, 1, 2]), position: .arabesque,
            supportingSide: .left, expectedView: .front
        ))
        guard case let .retake(report) = outcome else { return XCTFail("Expected retake") }
        XCTAssertEqual(report.reasons.first?.code, .decodeFailed)
        let calls = await detector.calls()
        XCTAssertEqual(calls, 0)
    }

    func testMultiplePeopleRetakesBeforeCrop() async {
        let person = TestLandmarkFactory.person()
        let detector = FakeDetector([whole([person, person])])
        let outcome = await AnalysisPipeline(detector: detector).analyze(request())
        guard case let .retake(report) = outcome else { return XCTFail("Expected retake") }
        XCTAssertTrue(report.reasons.contains { $0.code == .multiplePeople })
        let calls = await detector.calls()
        XCTAssertEqual(calls, 1)
    }

    func testSmallSubjectRetakesBeforeCrop() async {
        let small = TestLandmarkFactory.person().map { point in
            Landmark(name: point.name, x: 0.5 + (point.x - 0.5) * 0.12,
                     y: 0.5 + (point.y - 0.5) * 0.12, z: point.z,
                     visibility: point.visibility, presence: point.presence)
        }
        let outcome = await AnalysisPipeline(detector: FakeDetector([whole([small])])).analyze(request())
        guard case let .retake(report) = outcome else { return XCTFail("Expected retake") }
        XCTAssertEqual(report.reasons.first?.code, .subjectTooSmall)
    }

    func testSuccessfulTwoPassAnalysisReturnsAnnotatedResult() async {
        let person = TestLandmarkFactory.person()
        let detector = FakeDetector([whole([person]), whole([refinedPerson(person)])])
        let outcome = await AnalysisPipeline(detector: detector).analyze(request())
        guard case let .success(result, annotated) = outcome else {
            return XCTFail("Expected success, got \(outcome)")
        }
        XCTAssertEqual(result.position, .arabesque)
        XCTAssertEqual(result.landmarks.count, 33)
        XCTAssertEqual(annotated.cgImage?.width, 600)
        XCTAssertEqual(annotated.cgImage?.height, 800)
        let calls = await detector.calls()
        XCTAssertEqual(calls, 2)
    }

    func testSecondPassFailureIsInfrastructureFailure() async {
        let person = TestLandmarkFactory.person()
        let detector = FakeDetector([whole([person])], failAtCall: 1)
        let outcome = await AnalysisPipeline(detector: detector).analyze(request())
        guard case let .failure(error) = outcome else { return XCTFail("Expected failure") }
        XCTAssertEqual(error.localizedKey, "analysis.error.detection")
    }

    func testRendererFailureIsInfrastructureFailure() async {
        let person = TestLandmarkFactory.person()
        let detector = FakeDetector([whole([person]), whole([refinedPerson(person)])])
        let pipeline = AnalysisPipeline(detector: detector, render: { _, _, _ in
            throw ImageRenderError.allocationFailed
        })
        let outcome = await pipeline.analyze(request())
        guard case let .failure(error) = outcome else { return XCTFail("Expected failure") }
        XCTAssertEqual(error.localizedKey, "analysis.error.rendering")
    }

    func testUnavailableRequiredJointRetakes() async {
        let person = TestLandmarkFactory.person()
        let cropPerson = TestLandmarkFactory.update(
            refinedPerson(person), .rightKnee, visibility: 0.1
        )
        let detector = FakeDetector([whole([person]), whole([cropPerson])])
        let outcome = await AnalysisPipeline(detector: detector).analyze(request())
        guard case let .retake(report) = outcome else { return XCTFail("Expected retake") }
        XCTAssertTrue(report.reasons.contains { $0.code == .requiredJointsNotVisible })
    }

    func testCrossPassDisagreementRemovesPositionEvidence() async {
        let person = TestLandmarkFactory.person()
        let size = PixelSize(width: 600, height: 800)
        let rect = FocusedCrop.calculateRect(landmarks: person, sourceSize: size)!
        let cropPerson = refinedPerson(person).map { point in
            guard [.rightKnee, .rightAnkle, .rightHeel, .rightFootIndex].contains(point.name) else {
                return point
            }
            return Landmark(
                name: point.name, x: point.x + 0.25 * 600 / rect.width,
                y: point.y, z: point.z, visibility: point.visibility,
                presence: point.presence
            )
        }
        let detector = FakeDetector([whole([person]), whole([cropPerson])])
        let outcome = await AnalysisPipeline(detector: detector).analyze(request())
        guard case let .retake(report) = outcome else { return XCTFail("Expected retake") }
        XCTAssertEqual(report.reasons.first?.code, .unstablePoseLandmarks)
        XCTAssertTrue(report.unassessableRegions.contains(.workingLeg))
    }

    func testCancellationAfterFirstPassSkipsSecondPassAndRender() async {
        let detector = PausingFirstDetector(whole([TestLandmarkFactory.person()]))
        let pipeline = AnalysisPipeline(detector: detector, render: { _, _, _ in
            XCTFail("Cancelled work must not render")
            throw AnalysisError.renderingFailed
        })
        let task = Task { await pipeline.analyze(request()) }
        await detector.waitForFirstPass()
        task.cancel()
        await detector.releaseFirstPass()
        let outcome = await task.value
        guard case .cancelled = outcome else { return XCTFail("Expected cancellation") }
        let calls = await detector.calls()
        XCTAssertEqual(calls, 1)
    }

    func testAlreadyCancelledRequestDoesNotBeginInference() async {
        let detector = FakeDetector([whole([TestLandmarkFactory.person()])])
        let task = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            return await AnalysisPipeline(detector: detector).analyze(request())
        }
        let outcome = await task.value
        guard case .cancelled = outcome else { return XCTFail("Expected cancellation") }
        let calls = await detector.calls()
        XCTAssertEqual(calls, 0)
    }
}
