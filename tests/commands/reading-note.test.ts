import { beforeEach, describe, expect, it, vi } from "vitest";
import { Notice } from "obsidian";
import { handleGenerateReadingNote } from "../../src/commands/reading-note";
import type { RawSection } from "../../src/core/parser/sections";
import type { PluginSettings } from "../../src/types/compress";
import type { SectionAnalysis } from "../../src/types/structure";

const mocks = vi.hoisted(() => ({
	generateReadingNote: vi.fn(),
	resultModalOpen: vi.fn(),
}));

vi.mock("../../src/core/ai/note", () => ({
	generateReadingNote: mocks.generateReadingNote,
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

describe("handleGenerateReadingNote", () => {
	beforeEach(() => {
		noticeMock.mockClear();
		mocks.generateReadingNote.mockReset();
		mocks.resultModalOpen.mockReset();
	});

	it("处理中时直接拦截", async () => {
		const runtime = createRuntime();
		runtime.setProcessing(true);

		await handleGenerateReadingNote(
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
		expect(mocks.generateReadingNote).not.toHaveBeenCalled();
	});

	it("无勾选章节时提示并不调用 AI", async () => {
		await handleGenerateReadingNote(
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
		expect(mocks.generateReadingNote).not.toHaveBeenCalled();
	});

	it("选中章节无法映射到原文时提示", async () => {
		await handleGenerateReadingNote(
			{ app: {} } as never,
			createRuntime(),
			createEditor() as never,
			RAW_SECTIONS,
			[{ sourceIndex: 99, title: "丢失", summary: "丢失", tag: "深读" }],
			"standard",
			"整篇文档",
			8
		);

		expect(noticeMock).toHaveBeenCalledWith("未找到可生成笔记的章节");
		expect(mocks.generateReadingNote).not.toHaveBeenCalled();
	});

	it("成功生成后打开预览弹窗，并支持 callout 与标题块写入", async () => {
		const editor = createEditor();
		mocks.generateReadingNote.mockResolvedValue({
			summary: "核心观点",
			memorablePoints: ["记忆点"],
			connections: ["旧知"],
			questions: ["问题？"],
			markdown: "## 读书笔记\n\n### 核心观点\n核心观点",
			mode: "deep",
			sourceTitles: ["背景", "例子"],
		});

		await handleGenerateReadingNote(
			{ app: {} } as never,
			createRuntime(),
			editor as never,
			RAW_SECTIONS,
			ANALYSES,
			"deep",
			"整篇文档",
			8
		);

		expect(mocks.generateReadingNote).toHaveBeenCalledWith(
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
		expect(modal.opts.title).toBe("读书笔记");
		expect(modal.opts.scope).toBe("整篇文档");
		expect(modal.opts.copyText).toContain("## 读书笔记");
		expect(modal.opts.sections).toEqual(
			expect.arrayContaining([
				{ label: "笔记档位", text: "深度" },
				{ label: "来源章节", text: "- 背景\n- 例子" },
				{ label: "核心观点", text: "核心观点" },
			])
		);

		modal.opts.onInsert();
		expect(editor.replaceRange).toHaveBeenLastCalledWith(
			expect.stringContaining("> [!summary] 读书笔记 — 整篇文档"),
			{ line: 8, ch: 2 }
		);

		modal.opts.onInsertMarkdown();
		expect(editor.replaceRange).toHaveBeenLastCalledWith(
			expect.stringContaining("\n\n## 读书笔记"),
			{ line: 8, ch: 2 }
		);
	});
});
