import { beforeEach, describe, expect, it, vi } from "vitest";
import { Notice } from "obsidian";
import { registerTextActionCommands } from "../../src/commands/text-actions";
import type { PluginSettings } from "../../src/types/compress";

const mocks = vi.hoisted(() => ({
	askText: vi.fn(),
	compressText: vi.fn(),
	expandText: vi.fn(),
	handleGenerateTextReadingCheck: vi.fn(),
	handleGenerateReadingSynthesis: vi.fn(),
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

vi.mock("../../src/commands/reading-synthesis", () => ({
	handleGenerateReadingSynthesis: mocks.handleGenerateReadingSynthesis,
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
				defaultReadingNoteMode: "standard",
				...overrides,
			}) as PluginSettings,
		isProcessing: () => processing,
		setProcessing: (value: boolean) => {
			processing = value;
		},
	};
}

function createPlugin(text = "章节内容", selection = "") {
	const commands: Array<{ id: string; callback: () => unknown }> = [];
	const editor = {
		getSelection: vi.fn(() => selection),
		getCursor: vi.fn((side?: string) => ({
			line: side === "to" ? 1 : 0,
			ch: 0,
		})),
		getValue: vi.fn(() => text),
	};
	const plugin = {
		app: {
			workspace: {
				getActiveViewOfType: vi.fn(() => ({ editor })),
			},
		},
		addCommand: vi.fn((command) => {
			commands.push(command);
		}),
	};

	return { plugin, commands, editor };
}

function findCommand(
	commands: Array<{ id: string; callback: () => unknown }>,
	id: string
) {
	const command = commands.find((item) => item.id === id);
	if (!command) throw new Error(`Command not found: ${id}`);
	return command;
}

describe("registerTextActionCommands", () => {
	beforeEach(() => {
		noticeMock.mockClear();
		mocks.askText.mockReset();
		mocks.compressText.mockReset();
		mocks.expandText.mockReset();
		mocks.handleGenerateTextReadingCheck.mockReset();
		mocks.handleGenerateReadingSynthesis.mockReset();
		mocks.resultModalOpen.mockReset();
		mocks.askModalOpen.mockReset();
	});

	it("注册压缩、展开、提问和理解检查命令", () => {
		const { plugin, commands } = createPlugin();
		registerTextActionCommands(plugin as never, createRuntime());

		expect(plugin.addCommand).toHaveBeenCalledTimes(5);
		expect(commands.map((command) => command.id)).toEqual([
			"compress-selection",
			"expand-selection",
			"ask-selection",
			"reading-check-selection",
			"reading-synthesis-selection",
		]);
	});

	it("理解检查命令会沿用文本命令上下文", () => {
		const { plugin, commands, editor } = createPlugin("全文内容", "选中文本");
		registerTextActionCommands(plugin as never, createRuntime());

		findCommand(commands, "reading-check-selection").callback();

		expect(mocks.handleGenerateTextReadingCheck).toHaveBeenCalledWith(
			plugin,
			expect.objectContaining({ isProcessing: expect.any(Function) }),
			editor,
			"选中文本",
			1,
			"选中文本"
		);
	});

	it("读后沉淀命令会把当前文本包装成单章节链路", () => {
		const { plugin, commands, editor } = createPlugin("全文内容", "选中文本");
		registerTextActionCommands(plugin as never, createRuntime({
			defaultReadingNoteMode: "deep",
		}));

		findCommand(commands, "reading-synthesis-selection").callback();

		expect(mocks.handleGenerateReadingSynthesis).toHaveBeenCalledWith(
			plugin,
			expect.objectContaining({ isProcessing: expect.any(Function) }),
			editor,
			[
				{
					title: "选中文本",
					content: "选中文本",
					startLine: 1,
					endLine: 1,
				},
			],
			[
				{
					sourceIndex: 0,
					title: "选中文本",
					summary: "",
					tag: "深读",
				},
			],
			"deep",
			"选中文本",
			1
		);
	});
});
