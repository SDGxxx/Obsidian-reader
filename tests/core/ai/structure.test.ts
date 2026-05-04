import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginSettings } from "../../../src/types/compress";
import type { RawSection } from "../../../src/core/parser/sections";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: mockCreate };
		constructor() {}
	},
}));

vi.mock("../../../prompts/structure-map.md", () => ({
	default: "你是一个阅读辅助工具。",
}));

import { generateStructureMap } from "../../../src/core/ai/structure";

const VALID_SETTINGS: PluginSettings = {
	baseURL: "https://api.anthropic.com",
	authMode: "apiKey",
	secret: "sk-ant-test-key",
	rememberSecret: true,
	model: "claude-sonnet-4-6",
	defaultReadingNoteMode: "standard",
};

const SAMPLE_SECTIONS: RawSection[] = [
	{ title: "引言", content: "背景介绍", startLine: 0, endLine: 1 },
	{ title: "核心论点", content: "关键观点", startLine: 3, endLine: 5 },
];

const VALID_RESPONSE = JSON.stringify({
	sections: [
		{ index: 1, title: "引言", summary: "介绍背景", tag: "略读" },
		{ index: 2, title: "核心论点", summary: "提出关键观点", tag: "深读" },
	],
	highlights: ["核心论点最值得关注", "引言可快速浏览", "结论待补充"],
});

beforeEach(() => {
	mockCreate.mockReset();
});

describe("generateStructureMap", () => {
	it("正常返回：解析 JSON 结构", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: VALID_RESPONSE }],
		});

		const result = await generateStructureMap(SAMPLE_SECTIONS, VALID_SETTINGS);

		expect(result.sections).toHaveLength(2);
		expect(result.sections[0].sourceIndex).toBe(0);
		expect(result.sections[1].sourceIndex).toBe(1);
		expect(result.sections[0].tag).toBe("略读");
		expect(result.sections[1].tag).toBe("深读");
		expect(result.highlights).toHaveLength(3);
	});

	it("保留模型返回的章节编号，避免重排后操作错章节", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						sections: [
							{
								index: 2,
								title: "核心论点",
								summary: "提出关键观点",
								tag: "深读",
							},
							{
								index: 1,
								title: "引言",
								summary: "介绍背景",
								tag: "略读",
							},
						],
						highlights: ["核心论点最值得关注"],
					}),
				},
			],
		});

		const result = await generateStructureMap(SAMPLE_SECTIONS, VALID_SETTINGS);

		expect(result.sections[0].sourceIndex).toBe(1);
		expect(result.sections[1].sourceIndex).toBe(0);
	});

	it("旧格式无 index 时按返回顺序回退", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						sections: [
							{ title: "引言", summary: "介绍背景", tag: "略读" },
							{ title: "核心论点", summary: "提出关键观点", tag: "深读" },
						],
						highlights: [],
					}),
				},
			],
		});

		const result = await generateStructureMap(SAMPLE_SECTIONS, VALID_SETTINGS);

		expect(result.sections[0].sourceIndex).toBe(0);
		expect(result.sections[1].sourceIndex).toBe(1);
	});

	it("容忍 markdown 代码块包裹", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "```json\n" + VALID_RESPONSE + "\n```" }],
		});

		const result = await generateStructureMap(SAMPLE_SECTIONS, VALID_SETTINGS);
		expect(result.sections).toHaveLength(2);
	});

	it("兼容中文字段 JSON", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({
						章节: [
							{
								编号: 1,
								标题: "引言",
								核心意思: "介绍背景",
								阅读建议: "略读",
							},
							{
								编号: 2,
								标题: "核心论点",
								核心意思: "提出关键观点",
								阅读建议: "深读",
							},
						],
						重点: ["核心论点"],
					}),
				},
			],
		});

		const result = await generateStructureMap(SAMPLE_SECTIONS, VALID_SETTINGS);

		expect(result.sections[0]).toEqual(
			expect.objectContaining({
				sourceIndex: 0,
				title: "引言",
				summary: "介绍背景",
				tag: "略读",
			})
		);
		expect(result.sections[1].tag).toBe("深读");
		expect(result.highlights).toEqual(["核心论点"]);
	});

	it("兼容模型返回 Markdown 表格", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: [
						"| 编号 | 标题 | 核心意思 | 建议 |",
						"| 1 | 引言 | 介绍背景 | 略读 |",
						"| 2 | 核心论点 | 提出关键观点 | 深读 |",
						"最值得关注：核心论点",
					].join("\n"),
				},
			],
		});

		const result = await generateStructureMap(SAMPLE_SECTIONS, VALID_SETTINGS);

		expect(result.sections).toHaveLength(2);
		expect(result.sections[0].sourceIndex).toBe(0);
		expect(result.sections[1].tag).toBe("深读");
		expect(result.highlights[0]).toContain("最值得关注");
	});

	it("secret 为空时直接抛错", async () => {
		const settings = { ...VALID_SETTINGS, secret: "" };

		await expect(
			generateStructureMap(SAMPLE_SECTIONS, settings)
		).rejects.toThrow("请先在设置中配置密钥");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("空 sections 直接返回空结果", async () => {
		const result = await generateStructureMap([], VALID_SETTINGS);

		expect(result.sections).toHaveLength(0);
		expect(result.highlights).toHaveLength(0);
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("返回无效 JSON 时回退为本地结构地图", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "这不是JSON" }],
		});

		const result = await generateStructureMap(SAMPLE_SECTIONS, VALID_SETTINGS);

		expect(result.sections).toHaveLength(SAMPLE_SECTIONS.length);
		expect(result.sections[0]).toEqual(
			expect.objectContaining({
				sourceIndex: 0,
				title: SAMPLE_SECTIONS[0].title,
			})
		);
	});
});
