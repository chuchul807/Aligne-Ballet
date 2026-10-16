// swift-tools-version: 5.8
import PackageDescription

// Pinned binary URLs and checksums from google-ai-edge/mediapipe v1.1.0
// (821db8a4428baf58bf4c09a0330c937e6e0a3753). The local wrapper is
// needed because Xcode rejects the upstream remote package's -all_load flag.
let package = Package(
    name: "MediaPipeTasks",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "MediaPipeTasksVision", targets: ["MediaPipeTasksVision", "MediaPipeTasksCommon"]),
    ],
    targets: [
        .binaryTarget(
            name: "MediaPipeTasksCommonBinary",
            url: "https://dl.google.com/cpdc/20261005-190020/MediaPipeTasksCommon-1.1.0.xcframework.zip",
            checksum: "d2194b929b91f0c866b2f8d65003e08c474f6c85e8ca7293511e9ff4a780aa68"
        ),
        .binaryTarget(
            name: "MediaPipeTaskGraphsBinary",
            url: "https://dl.google.com/cpdc/20261005-190020/MediaPipeTaskGraphs-1.1.0.xcframework.zip",
            checksum: "6e59def0a86dcf8b357d6dc4220c8f45a3704449e7c7734677f2db50671c7def"
        ),
        .binaryTarget(
            name: "MediaPipeTasksVision",
            url: "https://dl.google.com/cpdc/20261005-190020/MediaPipeTasksVision-1.1.0.xcframework.zip",
            checksum: "d66d9929a28febdd52aba49b3336e1550e4526ab0b772c49321db05af5c7614e"
        ),
        .target(
            name: "MediaPipeTasksCommon",
            dependencies: ["MediaPipeTasksCommonBinary", "MediaPipeTaskGraphsBinary", "MediaPipeTasksVision"],
            linkerSettings: [
                .unsafeFlags(["-Xlinker", "-all_load"]),
                .linkedLibrary("c++"),
                .linkedLibrary("sqlite3"),
                .linkedFramework("Accelerate"),
                .linkedFramework("AVFoundation"),
                .linkedFramework("CoreMedia"),
                .linkedFramework("AudioToolbox"),
                .linkedFramework("CoreGraphics"),
                .linkedFramework("CoreImage"),
                .linkedFramework("CoreVideo"),
                .linkedFramework("QuartzCore"),
            ]
        ),
    ]
)
