import { beforeEach, describe, expect, it, vi } from "vitest";
import { Notice } from "obsidian";
import { registerStructureMapCommands } from "../../src/commands/structure-map";
import type { PluginSettings } from "../../src/types/compress";

const mocks = vi.hoisted(() => ({
	generateStructureMap: vi.fn(),
	modalOpen: vi.fn(),
}));

vi.mock("../../src/core/ai/structure", async () => {
	const actual = await vi.importActual("../../src/core/ai/structure");
	return {
		...actual,
		generateStructureMap: mocks.generateStructureMap,
	};
});

vi.mock("../../src/ui/structure-modal", () => ({
	StructureMapModal: class {
		constructor(public app: unknown, public opts: unknown) {}
		open() {
			mocks.modalOpen(this);
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

function createPlugin(doc: string, cursorLine = 0) {
	const commands: Array<{ id: string; callback: () => unknown }> = [];
	const editor = {
		getValue: vi.fn(() => doc),
		getCursor: vi.fn(() => ({ line: cursorLine, ch: 0 })),
		lineCount: vi.fn(() => doc.split("\n").length),
		replaceRange: vi.fn(),
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

	return { plugin, editor, commands };
}

function findCommand(
	commands: Array<{ id: string; callback: () => unknown }>,
	id: string
) {
	const command = commands.find((item) => item.id === id);
	if (!command) throw new Error(`Command not found: ${id}`);
	return command;
}

describe("registerStructureMapCommands", () => {
	beforeEach(() => {
		noticeMock.mockClear();
		mocks.generateStructureMap.mockReset();
		mocks.modalOpen.mockReset();
		vi.useRealTimers();
	});

	it("注册当前标题和整篇文档两个命令", () => {
		const { plugin, commands } = createPlugin("# 标题\n内容");
		registerStructureMapCommands(plugin as never, createRuntime());

		expect(plugin.addCommand).toHaveBeenCalledTimes(2);
		expect(commands.map((command) => command.id)).toEqual([
			"structure-map-heading",
			"structure-map-document",
		]);
	});

	it("处理中时拦截当前标题命令", async () => {
		const { plugin, commands } = createPlugin("# 标题\n内容");
		const runtime = createRuntime();
		runtime.setProcessing(true);
		registerStructureMapCommands(plugin as never, runtime);

		await findCommand(commands, "structure-map-heading").callback();

		expect(noticeMock).toHaveBeenCalledWith("正在处理中，请稍候");
		expect(mocks.generateStructureMap).not.toHaveBeenCalled();
	});

	it("当前标题模式下不在标题范围时提示", async () => {
		const { plugin, commands } = createPlugin("普通文本", 0);
		registerStructureMapCommands(plugin as never, createRuntime());

		await findCommand(commands, "structure-map-heading").callback();

		expect(noticeMock).toHaveBeenCalledWith(
			"光标不在任何标题范围内，请移到标题下方"
		);
	});

	it("整篇文档模式下空文档提示", async () => {
		const { plugin, commands } = createPlugin("   ");
		registerStructureMapCommands(plugin as never, createRuntime());

		await findCommand(commands, "structure-map-document").callback();

		expect(noticeMock).toHaveBeenCalledWith("当前文档为空");
	});

	it("整篇文档模式下超长文档提示", async () => {
		const { plugin, commands } = createPlugin("x".repeat(50001));
		registerStructureMapCommands(plugin as never, createRuntime());

		await findCommand(commands, "structure-map-document").callback();

		expect(noticeMock).toHaveBeenCalledWith(
			"文档过长（50001 字），请控制在 50000 字以内"
		);
	});

	it("成功生成当前标题结构地图并打开 modal", async () => {
		const doc = ["# 第一章", "引言内容", "## 1.1", "小节内容", "# 第二章", "后续"].join(
			"\n"
		);
		const { plugin, commands } = createPlugin(doc, 1);
		mocks.generateStructureMap.mockResolvedValue({
			sections: [
				{
					sourceIndex: 0,
					title: "第一章",
					summary: "介绍背景",
					tag: "深读",
				},
			],
			highlights: ["第一章"],
		});

		registerStructureMapCommands(plugin as never, createRuntime());
		await findCommand(commands, "structure-map-heading").callback();

		expect(mocks.generateStructureMap).toHaveBeenCalledWith(
			[
				{
					title: "第一章",
					content: "引言内容",
					startLine: 0,
					endLine: 1,
				},
				{
					title: "1.1",
					content: "小节内容",
					startLine: 2,
					endLine: 3,
				},
			],
			expect.objectContaining({ secret: "sk-ant-test" })
		);
		expect(mocks.modalOpen).toHaveBeenCalledOnce();
	});

	it("打开结构地图弹窗时传入设置中的默认读书笔记档位", async () => {
		const doc = ["# 第一章", "引言内容"].join("\n");
		const { plugin, commands } = createPlugin(doc, 1);
		mocks.generateStructureMap.mockResolvedValue({
			sections: [
				{
					sourceIndex: 0,
					title: "第一章",
					summary: "介绍背景",
					tag: "深读",
				},
			],
			highlights: ["第一章"],
		});

		registerStructureMapCommands(
			plugin as never,
			createRuntime({ defaultReadingNoteMode: "deep" })
		);
		await findCommand(commands, "structure-map-heading").callback();

		const modal = mocks.modalOpen.mock.calls[0][0];
		expect(modal.opts.defaultReadingNoteMode).toBe("deep");
		expect(modal.opts.sectionContentLengths).toEqual({ 0: 4 });
		expect(typeof modal.opts.onGenerateReadingCheck).toBe("function");
		expect(typeof modal.opts.onGenerateReadingSynthesis).toBe("function");
	});

	it("写入结构地图时包含范围、生成时间和当前深读/略读统计", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 4, 3, 10, 11));
		const doc = ["# 第一章", "引言内容", "## 1.1", "小节内容"].join("\n");
		const { plugin, editor, commands } = createPlugin(doc, 1);
		mocks.generateStructureMap.mockResolvedValue({
			sections: [
				{
					sourceIndex: 0,
					title: "第一章",
					summary: "介绍背景",
					tag: "深读",
				},
				{
					sourceIndex: 1,
					title: "1.1",
					summary: "补充例子",
					tag: "略读",
				},
			],
			highlights: ["第一章"],
		});

		registerStructureMapCommands(plugin as never, createRuntime());
		await findCommand(commands, "structure-map-heading").callback();
		const modal = mocks.modalOpen.mock.calls[0][0];

		modal.opts.onInsert([
			{
				sourceIndex: 0,
				title: "第一章",
				summary: "介绍背景",
				tag: "略读",
			},
			{
				sourceIndex: 1,
				title: "1.1",
				summary: "补充例子",
				tag: "略读",
			},
		]);

		expect(editor.replaceRange).toHaveBeenCalledWith(
			expect.stringContaining("> - 分析范围：第一章"),
			{ line: 0, ch: 0 }
		);
		expect(editor.replaceRange).toHaveBeenCalledWith(
			expect.stringContaining("> - 生成时间：2026-05-03 10:11"),
			{ line: 0, ch: 0 }
		);
		expect(editor.replaceRange).toHaveBeenCalledWith(
			expect.stringContaining("> - 章节统计：共 2 节，深读 0 节，略读 2 节"),
			{ line: 0, ch: 0 }
		);

		vi.useRealTimers();
	});
});
