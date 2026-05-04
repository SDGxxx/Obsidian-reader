import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginSettings } from "../../../src/types/compress";
import type { NoteSourceSection } from "../../../src/types/note";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: mockCreate };
		constructor() {}
	},
}));

vi.mock("../../../prompts/reading-note.md", () => ({
	default: "你是一个阅读辅助工具。",
}));

import { generateReadingNote } from "../../../src/core/ai/note";

const VALID_SETTINGS: PluginSettings = {
	baseURL: "https://api.anthropic.com",
	authMode: "apiKey",
	secret: "sk-ant-test-key",
	model: "claude-sonnet-4-6",
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
	summary: "本文讨论核心论点。",
	memorablePoints: ["核心点 A", "核心点 B"],
	connections: ["连接旧知 A"],
	questions: ["还可以追问什么？"],
	markdown:
		"## 读书笔记\n\n### 核心观点\n本文讨论核心论点。\n\n### 值得记住的点\n- 核心点 A",
});

beforeEach(() => {
	mockCreate.mockReset();
});

describe("generateReadingNote", () => {
	it("正常返回：解析结构化读书笔记", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: VALID_RESPONSE }],
		});

		const result = await generateReadingNote(MIXED_SECTIONS, VALID_SETTINGS);

		expect(result.summary).toBe("本文讨论核心论点。");
		expect(result.memorablePoints).toEqual(["核心点 A", "核心点 B"]);
		expect(result.connections).toEqual(["连接旧知 A"]);
		expect(result.questions).toEqual(["还可以追问什么？"]);
		expect(result.markdown).toContain("## 读书笔记");
		expect(result.mode).toBe("standard");
		expect(result.sourceTitles).toEqual(["背景", "核心论点"]);
		expect(result.markdown).toContain("> 笔记档位：标准");
		expect(result.markdown).toContain("> - 核心论点（深读，原文 #2）");
	});

	it("容忍 markdown 代码块包裹", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "```json\n" + VALID_RESPONSE + "\n```" }],
		});

		const result = await generateReadingNote(MIXED_SECTIONS, VALID_SETTINGS);
		expect(result.markdown).toContain("### 核心观点");
	});

	it("Markdown 结构不完整时使用结构化字段本地兜底", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						summary: "兜底摘要",
						memorablePoints: ["记忆点"],
						connections: ["旧知"],
						questions: ["问题？"],
						markdown: "只有一段普通文本",
					}),
				},
			],
		});

		const result = await generateReadingNote(MIXED_SECTIONS, VALID_SETTINGS, {
			mode: "light",
		});

		expect(result.markdown).toContain("## 读书笔记");
		expect(result.markdown).toContain("### 核心观点");
		expect(result.markdown).toContain("兜底摘要");
		expect(result.markdown).toContain("### 可连接旧知");
		expect(result.markdown).toContain("- 旧知");
		expect(result.markdown).toContain("### 待追问问题");
		expect(result.markdown).toContain("> 笔记档位：轻量");
	});

	it("支持传入深度档位，并写入用户消息", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: VALID_RESPONSE }],
		});

		const result = await generateReadingNote(MIXED_SECTIONS, VALID_SETTINGS, {
			mode: "deep",
		});

		expect(result.mode).toBe("deep");
		expect(result.markdown).toContain("> 笔记档位：深度");
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					expect.objectContaining({
						content: expect.stringContaining("笔记档位：深度"),
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

	it("支持传入前置理解检查，让笔记沿着核对点继续收束", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: VALID_RESPONSE }],
		});

		await generateReadingNote(MIXED_SECTIONS, VALID_SETTINGS, {
			readingCheckContext: {
				summary: "已经理解了核心论点",
				checkpoints: ["核对论证前提"],
				blindSpots: ["不要把背景当成结论"],
				questions: ["还有什么反例？"],
			},
		});

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					expect.objectContaining({
						content: expect.stringContaining("前置理解检查"),
					}),
				],
			})
		);
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					expect.objectContaining({
						content: expect.stringContaining("不要把背景当成结论"),
					}),
				],
			})
		);
	});

	it("无勾选章节时直接抛错，SDK 不被调用", async () => {
		await expect(
			generateReadingNote([], VALID_SETTINGS)
		).rejects.toThrow("请先选择至少一个章节");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("secret 为空时直接抛错", async () => {
		const settings = { ...VALID_SETTINGS, secret: "" };

		await expect(
			generateReadingNote(MIXED_SECTIONS, settings)
		).rejects.toThrow("请先在设置中配置密钥");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("已选章节过长时给出明确提示且不调用 SDK", async () => {
		await expect(
			generateReadingNote(
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
			generateReadingNote(MIXED_SECTIONS, VALID_SETTINGS)
		).rejects.toThrow("读书笔记生成失败：未获得有效结果");
	});

	it("返回不可解析内容时回退为 Markdown 文本", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "这不是 JSON" }],
		});

		const result = await generateReadingNote(MIXED_SECTIONS, VALID_SETTINGS);

		expect(result.summary).toBe("这不是 JSON");
		expect(result.markdown).toContain("## 读书笔记");
	});

	it("返回缺少 markdown 的 JSON 时会降级为结构化 Markdown", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						summary: "摘要",
						memorablePoints: [],
						connections: [],
						questions: [],
					}),
				},
			],
		});

		const result = await generateReadingNote(MIXED_SECTIONS, VALID_SETTINGS);

		expect(result.summary).toContain("摘要");
		expect(result.markdown).toContain("### 核心观点");
	});
});
