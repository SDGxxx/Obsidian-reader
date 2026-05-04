import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginSettings } from "../../../src/types/compress";
import type { NoteSourceSection } from "../../../src/types/note";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: mockCreate };
		constructor() {}
	},
}));

vi.mock("../../../prompts/reading-check.md", () => ({
	default: "你是一个阅读辅助工具。",
}));

import { generateReadingCheck } from "../../../src/core/ai/review";

const VALID_SETTINGS: PluginSettings = {
	baseURL: "https://api.anthropic.com",
	authMode: "apiKey",
	secret: "sk-ant-test-key",
	model: "claude-sonnet-4-6",
	defaultReadingNoteMode: "standard",
};

const MIXED_SECTIONS: NoteSourceSection[] = [
	{
		sourceIndex: 0,
		title: "背景",
		tag: "略读",
		content: "这是背景内容。",
	},
	{
		sourceIndex: 1,
		title: "核心论点",
		tag: "深读",
		content: "这是核心论点内容。",
	},
];

const VALID_RESPONSE = JSON.stringify({
	summary: "本文围绕核心论点展开。",
	checkpoints: ["需要核对核心论点的前提", "需要确认例子如何支撑论点"],
	blindSpots: ["不要把背景当成结论"],
	questions: ["这个论证还有什么反例？"],
	markdown:
		"## 理解检查\n\n### 核心理解\n本文围绕核心论点展开。\n\n### 关键核对点\n- 需要核对核心论点的前提",
});

beforeEach(() => {
	mockCreate.mockReset();
});

describe("generateReadingCheck", () => {
	it("正常返回：解析结构化理解检查", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: VALID_RESPONSE }],
		});

		const result = await generateReadingCheck(MIXED_SECTIONS, VALID_SETTINGS);

		expect(result.summary).toBe("本文围绕核心论点展开。");
		expect(result.checkpoints).toEqual([
			"需要核对核心论点的前提",
			"需要确认例子如何支撑论点",
		]);
		expect(result.blindSpots).toEqual(["不要把背景当成结论"]);
		expect(result.questions).toEqual(["这个论证还有什么反例？"]);
		expect(result.markdown).toContain("## 理解检查");
		expect(result.mode).toBe("standard");
		expect(result.sourceTitles).toEqual(["背景", "核心论点"]);
		expect(result.markdown).toContain("> 检查档位：标准");
		expect(result.markdown).toContain("> - 核心论点（深读，原文 #2）");
	});

	it("Markdown 结构不完整时使用结构化字段本地兜底", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						summary: "兜底理解",
						checkpoints: ["核对点"],
						blindSpots: ["盲区"],
						questions: ["问题？"],
						markdown: "只有一段普通文本",
					}),
				},
			],
		});

		const result = await generateReadingCheck(MIXED_SECTIONS, VALID_SETTINGS, {
			mode: "light",
		});

		expect(result.markdown).toContain("## 理解检查");
		expect(result.markdown).toContain("### 关键核对点");
		expect(result.markdown).toContain("兜底理解");
		expect(result.markdown).toContain("### 容易误解的地方");
		expect(result.markdown).toContain("- 盲区");
		expect(result.markdown).toContain("### 追问问题");
		expect(result.markdown).toContain("> 检查档位：轻量");
	});

	it("支持传入深度档位，并写入用户消息", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: VALID_RESPONSE }],
		});

		const result = await generateReadingCheck(MIXED_SECTIONS, VALID_SETTINGS, {
			mode: "deep",
		});

		expect(result.mode).toBe("deep");
		expect(result.markdown).toContain("> 检查档位：深度");
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					expect.objectContaining({
						content: expect.stringContaining("检查档位：深度"),
					}),
				],
			})
		);
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					expect.objectContaining({
						content: expect.stringContaining("原文下标：1"),
					}),
				],
			})
		);
	});

	it("无勾选章节时直接抛错，SDK 不被调用", async () => {
		await expect(
			generateReadingCheck([], VALID_SETTINGS)
		).rejects.toThrow("请先选择至少一个章节");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("secret 为空时直接抛错", async () => {
		const settings = { ...VALID_SETTINGS, secret: "" };

		await expect(
			generateReadingCheck(MIXED_SECTIONS, settings)
		).rejects.toThrow("请先在设置中配置密钥");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("已选章节过长时给出明确提示且不调用 SDK", async () => {
		await expect(
			generateReadingCheck(
				[
					{
						sourceIndex: 0,
						title: "超长章节",
						tag: "深读",
						content: "x".repeat(30001),
					},
				],
				VALID_SETTINGS
			)
		).rejects.toThrow("已选章节过长（30001 字）");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("返回空文本块时抛出明确错误", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "   " }],
		});

		await expect(
			generateReadingCheck(MIXED_SECTIONS, VALID_SETTINGS)
		).rejects.toThrow("理解检查生成失败：未获得有效结果");
	});

	it("返回不可解析内容时回退为 Markdown 文本", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "这不是 JSON" }],
		});

		const result = await generateReadingCheck(MIXED_SECTIONS, VALID_SETTINGS);

		expect(result.summary).toBe("这不是 JSON");
		expect(result.markdown).toContain("## 理解检查");
	});

	it("返回缺少 markdown 的 JSON 时会降级为结构化 Markdown", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						summary: "摘要",
						checkpoints: [],
						blindSpots: [],
						questions: [],
					}),
				},
			],
		});

		const result = await generateReadingCheck(MIXED_SECTIONS, VALID_SETTINGS);

		expect(result.summary).toContain("摘要");
		expect(result.markdown).toContain("### 核心理解");
	});
});
