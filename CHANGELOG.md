# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2026-05-04

### Added

- 压缩、展开、提问、结构地图、结构化读书笔记、理解检查、读后沉淀完整链路
- 结构地图阅读控制台，支持章节勾选、深读/略读调整、恢复上次结果
- 统一的 Reader 弹窗 UI
- 兼容 Anthropic 官方接口和 authToken 模式中转站
- 提示词与解析兜底逻辑
- 完整测试集和 GitHub Actions CI / Release 工作流

### Improved

- 结构地图、读书笔记、理解检查对非标准 AI 返回格式的容错
- 提示词稳定性和“只基于原文”约束
- 密钥隐私说明与 `Remember Secret` 会话级配置
