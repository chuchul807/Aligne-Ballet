import XCTest
@testable import AligneBallet

final class PoseMeasurerTests: XCTestCase {
    func testEveryMeasurementMatchesWebFixture() throws {
        let fixture = try ParityFixtureLoader.load()

        for testCase in fixture.measurementCases {
            let landmarks = ParityFixtureLoader.landmarks(for: testCase, in: fixture)
            let measurements = PoseMeasurer.measure(
                landmarks: landmarks,
                supportingSide: testCase.supportingSide,
                reliability: ParityFixtureLoader.reliability(for: landmarks),
                view: testCase.view,
                sourceSize: testCase.sourceSize
            )
            let actual = ParityFixtureLoader.measurementsByName(measurements)
            let expected = testCase.expectedValues.byName

            XCTAssertEqual(actual.count, 22, testCase.id)
            XCTAssertEqual(Set(actual.keys), Set(expected.keys), testCase.id)

            for (name, measurement) in actual {
                let expectedValue = expected[name]!
                let expectedReason = testCase.expectedUnassessableReasons[name]

                if let expectedValue {
                    XCTAssertEqual(measurement.value!, expectedValue, accuracy: 0.000001, "\(testCase.id).\(name)")
                } else {
                    XCTAssertNil(measurement.value, "\(testCase.id).\(name)")
                }
                XCTAssertEqual(
                    measurement.assessability,
                    expectedReason == nil ? .assessable : .unassessable,
                    "\(testCase.id).\(name)"
                )
                XCTAssertEqual(measurement.reason, expectedReason, "\(testCase.id).\(name)")
                XCTAssertEqual(
                    measurement.confidence,
                    testCase.expectedLowConfidence.contains(name) ? .low : .high,
                    "\(testCase.id).\(name)"
                )
            }
        }
    }

    func testMissingEvidenceIsUnassessable() throws {
        let fixture = try ParityFixtureLoader.load()
        let testCase = try XCTUnwrap(fixture.measurementCases.first { $0.id == "missing-supporting-ankle" })
        let landmarks = ParityFixtureLoader.landmarks(for: testCase, in: fixture)

        let measurements = PoseMeasurer.measure(
            landmarks: landmarks,
            supportingSide: testCase.supportingSide,
            reliability: ParityFixtureLoader.reliability(for: landmarks),
            view: testCase.view,
            sourceSize: testCase.sourceSize
        )

        XCTAssertEqual(measurements.supportingKneeAngle.assessability, .unassessable)
        XCTAssertEqual(measurements.supportingKneeAngle.reason, .missing)
        XCTAssertEqual(measurements.supportingKneeAngle.confidence, .low)
        XCTAssertNil(measurements.supportingKneeAngle.value)
    }
}
