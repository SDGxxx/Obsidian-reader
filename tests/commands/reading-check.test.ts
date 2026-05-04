import { beforeEach, describe, expect, it, vi } from "vitest";
import { Notice } from "obsidian";
import {
	handleGenerateReadingCheck,
	handleGenerateTextReadingCheck,
} from "../../src/commands/reading-check";
import type { RawSection } from "../../src/core/parser/sections";
import type { PluginSettings } from "../../src/types/compress";
import type { SectionAnalysis } from "../../src/types/structure";

const mocks = vi.hoisted(() => ({
	generateReadingCheck: vi.fn(),
	resultModalOpen: vi.fn(),
}));

vi.mock("../../src/core/ai/review", () => ({
	generateReadingCheck: mocks.generateReadingCheck,
}));

vi.mock("../../src/ui/result-modal", () => ({
	ResultModal: class {
		constructor(public app: unknown, public opts: unknown) {}
		open() {
			mocks.resultModalOpen(this);
		}
	},
}));

const noticeMock = Notice as unknown as ReturnType<typeof vi.fn>;

const RAW_SECTIONS: RawSection[] = [
	{ title: "原始背景", content: "背景内容", startLine: 0, endLine: 2 },
	{ title: "原始论点", content: "论点内容", startLine: 3, endLine: 5 },
	{ title: "原始例子", content: "例子内容", startLine: 6, endLine: 8 },
];

const ANALYSES: SectionAnalysis[] = [
	{ sourceIndex: 2, title: "例子", summary: "例子", tag: "深读" },
	{ sourceIndex: 0, title: "背景", summary: "背景", tag: "略读" },
];

function createRuntime(overrides: Partial<PluginSettings> = {}) {
	let processing = false;
	return {
		getSettings: () =>
			({
				baseURL: "https://api.anthropic.com",
				authMode: "apiKey",
				secret: "sk-ant-test",
				model: "claude-sonnet-4-6",
				...overrides,
			}) as PluginSettings,
		isProcessing: () => processing,
		setProcessing: (value: boolean) => {
			processing = value;
		},
	};
}

function createEditor() {
	const lines = [
		"# 背景",
		"背景内容",
		"",
		"# 论点",
		"论点内容",
		"",
		"# 例子",
		"例子内容",
		"尾行",
	];
	return {
		getLine: vi.fn((line: number) => lines[line] ?? ""),
		lineCount: vi.fn(() => lines.length),
		replaceRange: vi.fn(),
	};
}

describe("handleGenerateReadingCheck", () => {
	beforeEach(() => {
		noticeMock.mockClear();
		mocks.generateReadingCheck.mockReset();
		mocks.resultModalOpen.mockReset();
	});

	it("处理中时直接拦截", async () => {
		const runtime = createRuntime();
		runtime.setProcessing(true);

		await handleGenerateReadingCheck(
			{ app: {} } as never,
			runtime,
			createEditor() as never,
			RAW_SECTIONS,
			ANALYSES,
			"standard",
			"整篇文档",
			8
		);

		expect(noticeMock).toHaveBeenCalledWith("正在处理中，请稍候");
		expect(mocks.generateReadingCheck).not.toHaveBeenCalled();
	});

	it("无勾选章节时提示并不调用 AI", async () => {
		await handleGenerateReadingCheck(
			{ app: {} } as never,
			createRuntime(),
			createEditor() as never,
			RAW_SECTIONS,
			[],
			"standard",
			"整篇文档",
			8
		);

		expect(noticeMock).toHaveBeenCalledWith("请先勾选至少一个章节");
		expect(mocks.generateReadingCheck).not.toHaveBeenCalled();
	});

	it("选中章节无法映射到原文时提示", async () => {
		await handleGenerateReadingCheck(
			{ app: {} } as never,
			createRuntime(),
			createEditor() as never,
			RAW_SECTIONS,
			[{ sourceIndex: 99, title: "丢失", summary: "丢失", tag: "深读" }],
			"standard",
			"整篇文档",
			8
		);

		expect(noticeMock).toHaveBeenCalledWith("未找到可生成理解检查的章节");
		expect(mocks.generateReadingCheck).not.toHaveBeenCalled();
	});

	it("成功生成后打开预览弹窗，并支持 callout 与标题块写入", async () => {
		const editor = createEditor();
		mocks.generateReadingCheck.mockResolvedValue({
			summary: "核心理解",
			checkpoints: ["核对点"],
			blindSpots: ["盲区"],
			questions: ["问题？"],
			markdown: "## 理解检查\n\n### 核心理解\n核心理解",
			mode: "deep",
			sourceTitles: ["背景", "例子"],
		});

		await handleGenerateReadingCheck(
			{ app: {} } as never,
			createRuntime(),
			editor as never,
			RAW_SECTIONS,
			ANALYSES,
			"deep",
			"整篇文档",
			8
		);

		expect(mocks.generateReadingCheck).toHaveBeenCalledWith(
			[
				{
					sourceIndex: 0,
					title: "背景",
					tag: "略读",
					content: "背景内容",
				},
				{
					sourceIndex: 2,
					title: "例子",
					tag: "深读",
					content: "例子内容",
				},
			],
			expect.objectContaining({ secret: "sk-ant-test" }),
			{ mode: "deep" }
		);

		expect(mocks.resultModalOpen).toHaveBeenCalledOnce();
		const modal = mocks.resultModalOpen.mock.calls[0][0];
		expect(modal.opts.title).toBe("理解检查");
		expect(modal.opts.scope).toBe("整篇文档");
		expect(modal.opts.copyText).toContain("## 理解检查");
		expect(modal.opts.sections).toEqual(
			expect.arrayContaining([
				{ label: "检查档位", text: "深度" },
				{ label: "来源章节", text: "- 背景\n- 例子" },
				{ label: "核心理解", text: "核心理解" },
			])
		);

		modal.opts.onInsert();
		expect(editor.replaceRange).toHaveBeenLastCalledWith(
			expect.stringContaining("> [!summary] 理解检查 — 整篇文档"),
			{ line: 8, ch: 2 }
		);

		modal.opts.onInsertMarkdown();
		expect(editor.replaceRange).toHaveBeenLastCalledWith(
			expect.stringContaining("\n\n## 理解检查"),
			{ line: 8, ch: 2 }
		);
	});

	it("可直接基于选中文本生成理解检查", async () => {
		const editor = createEditor();
		mocks.generateReadingCheck.mockResolvedValue({
			summary: "选区理解",
			checkpoints: ["核对点"],
			blindSpots: ["盲区"],
			questions: ["问题？"],
			markdown: "## 理解检查\n\n### 核心理解\n选区理解",
			mode: "standard",
			sourceTitles: ["选中文本"],
		});

		await handleGenerateTextReadingCheck(
			{ app: {} } as never,
			createRuntime({ defaultReadingNoteMode: "light" }),
			editor as never,
			"选中文本内容",
			1,
			"选中文本"
		);

		expect(mocks.generateReadingCheck).toHaveBeenCalledWith(
			[
				{
					sourceIndex: 0,
					title: "选中文本",
					tag: "深读",
					content: "选中文本内容",
				},
			],
			expect.objectContaining({ secret: "sk-ant-test" }),
			{ mode: "light" }
		);
		const modal = mocks.resultModalOpen.mock.calls[0][0];
		expect(modal.opts.title).toBe("理解检查");
		expect(modal.opts.scope).toBe("选中文本");
		expect(modal.opts.sections).toEqual(
			expect.arrayContaining([
				{ label: "检查档位", text: "轻量" },
				{ label: "来源章节", text: "- 选中文本" },
			])
		);
	});
});
