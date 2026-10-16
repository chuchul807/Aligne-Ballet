import XCTest
@testable import AligneBallet

final class GeometryTests: XCTestCase {
    func testGeometryMatchesWebFixtureWithinOneEMinusSix() throws {
        let fixture = try ParityFixtureLoader.load()

        for testCase in fixture.geometryCases {
            let a = Geometry.Point(x: testCase.a.x, y: testCase.a.y)
            let b = Geometry.Point(x: testCase.b.x, y: testCase.b.y)

            switch testCase.operation {
            case "distance":
                XCTAssertEqual(Geometry.distance(a, b)!, testCase.expected!, accuracy: 0.000001, testCase.id)
            case "midpoint":
                let actual = try XCTUnwrap(Geometry.midpoint(a, b))
                XCTAssertEqual(actual.x, testCase.expectedPoint!.x, accuracy: 0.000001, testCase.id)
                XCTAssertEqual(actual.y, testCase.expectedPoint!.y, accuracy: 0.000001, testCase.id)
            case "angleDegrees":
                let vertex = Geometry.Point(x: testCase.vertex!.x, y: testCase.vertex!.y)
                if let expected = testCase.expected {
                    XCTAssertEqual(
                        try XCTUnwrap(Geometry.angleDegrees(a, vertex: vertex, b)),
                        expected,
                        accuracy: 0.000001,
                        testCase.id
                    )
                } else {
                    XCTAssertNil(Geometry.angleDegrees(a, vertex: vertex, b), testCase.id)
                }
            case "slopeDegrees":
                XCTAssertEqual(Geometry.slopeDegrees(a, b)!, testCase.expected!, accuracy: 0.000001, testCase.id)
            case "normalizedDistance":
                XCTAssertEqual(
                    try XCTUnwrap(Geometry.normalizedDistance(a, b, scale: testCase.scale!)),
                    testCase.expected!,
                    accuracy: 0.000001,
                    testCase.id
                )
            default:
                XCTFail("Unknown geometry operation: \(testCase.operation)")
            }
        }
    }
}
