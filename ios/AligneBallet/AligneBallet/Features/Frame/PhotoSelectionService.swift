import Foundation
import ImageIO
import PhotosUI
import SwiftUI

protocol PhotoSelectionServing {
    func loadData(from item: PhotosPickerItem?) async throws -> Data?
}

struct PhotoSelectionService: PhotoSelectionServing {
    private let maximumBytes = 12 * 1024 * 1024

    func loadData(from item: PhotosPickerItem?) async throws -> Data? {
        guard let item else { return nil }
        guard let data = try await item.loadTransferable(type: Data.self) else {
            throw ImageInputError.decodeFailed
        }
        return try validate(data)
    }

    func validate(_ data: Data) throws -> Data {
        guard data.count <= maximumBytes else { throw ImageInputError.fileTooLarge }
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceGetCount(source) > 0,
              CGImageSourceGetType(source) != nil else {
            throw ImageInputError.decodeFailed
        }
        return data
    }
}
