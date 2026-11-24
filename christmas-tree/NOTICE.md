# 第三方依赖声明 / Third-Party Notices

本项目在某些模块中使用了以下第三方开源软件。它们的版权与许可归各自所有者所有，本项目对其作者表示感谢。

## Three.js

- **版本**：r160（本地文件 `vendor/three/`）
- **许可**：MIT License
- **版权**：Copyright © 2010-2024 three.js authors
- **主页**：https://threejs.org/
- **许可证全文**：https://github.com/mrdoob/three.js/blob/master/LICENSE

本项目使用了 `three.module.js`、`OrbitControls.js`、`RoomEnvironment.js`。

## MediaPipe Tasks Vision

- **版本**：0.10.21（本地文件 `vendor/mediapipe/` 与生成产物）
- **许可**：Apache License 2.0
- **版权**：Copyright © Google LLC
- **主页**：https://ai.google.dev/edge/mediapipe
- **许可证全文**：https://www.apache.org/licenses/LICENSE-2.0

本项目使用了 `vision_bundle.js`、`wasm/` 下的 WASM / JS 运行时，用于浏览器端手部关键点检测（Hand Landmarker）。

## hand_landmarker.task 模型

- **来源**：Google MediaPipe 官方预训练手部关键点模型
- **许可**：Apache License 2.0
- **说明**：模型文件仅用于浏览器端本地推理，随项目一同分发以便离线使用。

---

上述第三方组件的原始版权声明与许可条款仍然有效。本项目自己的源代码采用 [MIT License](./LICENSE)。
