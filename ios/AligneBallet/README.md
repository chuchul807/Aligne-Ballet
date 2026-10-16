# ALIGNÉ iPhone 原生版

这是与现有网站并行的 SwiftUI 应用，不是网页容器。相册或相机照片在 iPhone 本机完成图像处理、MediaPipe 姿态识别、五个动作的规则评估与标注绘制；不建立账号、不上传照片、不保存原图或历史记录。用户点按“保存标注照片”后，才向系统申请仅添加照片的权限。

## 支持范围

- Xcode 工程：`AligneBallet.xcodeproj`；iPhone 竖屏，部署目标 iOS 16.0。
- 推荐 iPhone 13 或更新机型。部署目标不等于已在该机型及系统版本完成验证；见下方状态。
- Arabesque 与 Attitude derrière：四分之三侧面；Retiré / Passé、À la seconde、Tendu croisé devant：正面。
- 左、右支撑腿由使用者选择；一次分析一张照片，建议全身入镜、单人、光线充足。
- 英文和简体中文；结果最多显示三条高可信度建议。无法可靠判断的部位不会给出肯定性纠正。

## 在 Mac 上打开

1. 安装 Xcode，首次启动时完成附加组件安装。安装 Node.js 和 pnpm；在仓库根目录执行 `pnpm install`。
2. 在仓库根目录执行 `pnpm sync:ios-model`。脚本核对 Pose Landmarker Heavy 模型的 SHA-256 `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b`，将其放入应用资源目录；生成文件已忽略，不要提交。
3. 用 Xcode 打开 `ios/AligneBallet/AligneBallet.xcodeproj`，等待本地 `MediaPipeTasks` Swift Package 的三个官方二进制依赖下载完成。二进制版本与校验值固定在 `ios/MediaPipeTasks/Package.swift`。
4. 选择 `AligneBallet` scheme 和目标模拟器；真机运行前在 Signing & Capabilities 选择个人 Apple Team。若 bundle identifier 与已有 App ID 冲突，可在本机改为自己的唯一标识。
5. 点 Run。首次启动不需要网络；模型与分析过程均在应用内。

若 Xcode 的旧 Swift Package 缓存下载损坏，可在终端指定新的包缓存目录重新测试：

```sh
xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj \
  -scheme AligneBallet \
  -clonedSourcePackagesDirPath /tmp/aligne-mediapipe-spm \
  -destination 'platform=iOS Simulator,name=Aligne Tests' \
  -parallel-testing-enabled NO test
```

`Aligne Tests` 是本开发机创建的模拟器名称；在别的 Mac 上请换成实际可用的目标。正常 Xcode 使用无需上述临时缓存参数。

## 隐私与权限

相机只在用户点按拍摄时请求权限。系统 `PhotosPicker` 不申请整个图库的读取权限。保存只写入分析后绘制标注的图片，且仅在用户明确点按保存后请求 Photos 的 add-only 权限；拒绝权限时结果留在屏幕上，并提供打开系统设置的入口。没有云端分析、账户或自动上传。

## 测试与尚待验证

开发机当前仅安装 iOS 27.1 模拟器；已用它运行领域逻辑、模型加载、完整流程与中英文界面自动化测试。工程部署目标为 iOS 16.0，但尚未在 iOS 16、iOS 17 运行时或 iPhone 13 真机上实测。也尚未用授权的真实舞者照片完成跨平台接受测试，因此不能视为 App Store 发布验收完成。

交付前请在 iPhone 13 或更新真机上分别记录 iOS 16/17（有设备时）及当前系统的结果：

- 五个动作、左右支撑腿、相机与相册入口、飞行模式分析、取消/重拍、拒绝相机权限、拒绝保存权限、英文与简体中文、大字号。
- 每张已授权测试照片应在网站和 iOS 使用相同动作/支撑侧；记录是否可评估、Top 3 的 `region + direction`、标注命令。可评估照片至少两项匹配；若一侧保守输出少于两项，则全部输出项都应匹配。照片不入 Git。
- iPhone 13 上记录图像正规化、全图识别、局部再识别、规则、绘制、总耗时和峰值内存。目标约 5 秒；稳定超过 8 秒应优化。连续分析至少 20 次，检查内存回到接近基线且不会单调攀升。

以上项目需要真实设备和经授权照片；模拟器通过、最低部署版本和通用设备编译都不能替代实机结论。
