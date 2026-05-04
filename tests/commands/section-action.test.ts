import { beforeEach, describe, expect, it, vi } from "vitest";
import { Notice } from "obsidian";
import { handleSectionAction } from "../../src/commands/section-action";
import type { PluginSettings } from "../../src/types/compress";

const mocks = vi.hoisted(() => ({
	askText: vi.fn(),
	compressText: vi.fn(),
	expandText: vi.fn(),
	handleGenerateTextReadingCheck: vi.fn(),
	resultModalOpen: vi.fn(),
	askModalOpen: vi.fn(),
}));

vi.mock("../../src/core/ai/ask", () => ({
	askText: mocks.askText,
}));

vi.mock("../../src/core/ai/compress", () => ({
	compressText: mocks.compressText,
}));

vi.mock("../../src/core/ai/expand", () => ({
	expandText: mocks.expandText,
}));

vi.mock("../../src/commands/reading-check", () => ({
	handleGenerateTextReadingCheck: mocks.handleGenerateTextReadingCheck,
}));

vi.mock("../../src/ui/result-modal", () => ({
	ResultModal: class {
		constructor(public app: unknown, public opts: unknown) {}
		open() {
			mocks.resultModalOpen(this);
		}
	},
}));

vi.mock("../../src/ui/ask-input-modal", () => ({
	AskInputModal: class {
		constructor(public app: unknown, public onSubmit: (question: string) => unknown) {}
		open() {
			mocks.askModalOpen(this);
		}
	},
}));

const noticeMock = Notice as unknown as ReturnType<typeof vi.fn>;

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
	return {
		getLine: vi.fn(() => "章节内容"),
		lineCount: vi.fn(() => 1),
		replaceRange: vi.fn(),
	};
}

function flushAsync() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("handleSectionAction", () => {
	beforeEach(() => {
		noticeMock.mockClear();
		mocks.askText.mockReset();
		mocks.compressText.mockReset();
		mocks.expandText.mockReset();
		mocks.handleGenerateTextReadingCheck.mockReset();
		mocks.resultModalOpen.mockReset();
		mocks.askModalOpen.mockReset();
	});

	it("处理中时直接拦截", () => {
		const runtime = createRuntime();
		runtime.setProcessing(true);

		handleSectionAction(
			{ app: {} } as never,
			runtime,
			createEditor() as never,
			"章节内容",
			0,
			"compress"
		);

		expect(noticeMock).toHaveBeenCalledWith("正在处理中，请稍候");
		expect(mocks.compressText).not.toHaveBeenCalled();
	});

	it("压缩章节后打开结果弹窗", async () => {
		mocks.compressText.mockResolvedValue({
			original: "章节内容",
			compressed: "压缩结果",
			ratio: 0.5,
		});

		handleSectionAction(
			{ app: {} } as never,
			createRuntime(),
			createEditor() as never,
			"章节内容",
			0,
			"compress"
		);
		await flushAsync();

		expect(mocks.compressText).toHaveBeenCalledWith(
			"章节内容",
			expect.objectContaining({ secret: "sk-ant-test" })
		);
		expect(mocks.resultModalOpen).toHaveBeenCalledOnce();
		const modal = mocks.resultModalOpen.mock.calls[0][0];
		expect(modal.opts.title).toBe("压缩结果");
		expect(modal.opts.copyText).toBe("压缩结果");
	});

	it("展开章节后打开结果弹窗", async () => {
		mocks.expandText.mockResolvedValue({
			original: "章节内容",
			expanded: "展开结果",
		});

		handleSectionAction(
			{ app: {} } as never,
			createRuntime(),
			createEditor() as never,
			"章节内容",
			0,
			"expand"
		);
		await flushAsync();

		expect(mocks.expandText).toHaveBeenCalledWith(
			"章节内容",
			expect.objectContaining({ secret: "sk-ant-test" })
		);
		expect(mocks.resultModalOpen).toHaveBeenCalledOnce();
		const modal = mocks.resultModalOpen.mock.calls[0][0];
		expect(modal.opts.title).toBe("展开结果");
		expect(modal.opts.copyText).toBe("展开结果");
	});

	it("提问章节先打开输入弹窗，提交后打开结果弹窗", async () => {
		mocks.askText.mockResolvedValue({
			original: "章节内容",
			question: "为什么？",
			answer: "回答",
		});

		handleSectionAction(
			{ app: {} } as never,
			createRuntime(),
			createEditor() as never,
			"章节内容",
			0,
			"ask"
		);

		expect(mocks.askModalOpen).toHaveBeenCalledOnce();
		const askModal = mocks.askModalOpen.mock.calls[0][0];
		await askModal.onSubmit("为什么？");

		expect(mocks.askText).toHaveBeenCalledWith(
			"章节内容",
			"为什么？",
			expect.objectContaining({ secret: "sk-ant-test" })
		);
		const resultModal = mocks.resultModalOpen.mock.calls[0][0];
		expect(resultModal.opts.title).toBe("提问结果");
		expect(resultModal.opts.copyText).toBe("回答");
	});

	it("理解检查章节时复用文本理解检查链路", async () => {
		const editor = createEditor();
		const runtime = createRuntime({ defaultReadingNoteMode: "deep" });
		const plugin = { app: {} };

		handleSectionAction(
			plugin as never,
			runtime,
			editor as never,
			"章节内容",
			0,
			"check"
		);
		await flushAsync();

		expect(mocks.handleGenerateTextReadingCheck).toHaveBeenCalledWith(
			plugin,
			runtime,
			editor,
			"章节内容",
			0,
			"当前章节"
		);
	});
});
