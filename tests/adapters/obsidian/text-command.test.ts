import { beforeEach, describe, expect, it, vi } from "vitest";
import { Notice } from "obsidian";

import { prepareTextCommand } from "../../../src/adapters/obsidian/text-command";

const noticeMock = Notice as unknown as ReturnType<typeof vi.fn>;

interface MockEditorOptions {
	value: string;
	selection?: string;
	cursorLine?: number;
	toLine?: number;
}

function createApp(options: MockEditorOptions) {
	const editor = {
		getSelection: vi.fn(() => options.selection || ""),
		getCursor: vi.fn((side?: string) => ({
			line: side === "to" ? options.toLine ?? 0 : options.cursorLine ?? 0,
			ch: 0,
		})),
		getValue: vi.fn(() => options.value),
	};
	const view = { editor };
	const app = {
		workspace: {
			getActiveViewOfType: vi.fn(() => view),
		},
	};

	return { app, editor, view };
}

describe("prepareTextCommand", () => {
	beforeEach(() => {
		noticeMock.mockClear();
	});

	it("处理中时直接返回 null 并提示", () => {
		const { app } = createApp({ value: "正文" });

		expect(prepareTextCommand(app as never, true)).toBeNull();
		expect(noticeMock).toHaveBeenCalledWith("正在处理中，请稍候");
	});

	it("没有活动 Markdown 编辑器时返回 null", () => {
		const app = {
			workspace: {
				getActiveViewOfType: vi.fn(() => null),
			},
		};

		expect(prepareTextCommand(app as never, false)).toBeNull();
		expect(noticeMock).toHaveBeenCalledWith("未找到可用编辑器");
	});

	it("优先使用选中文本，并用 selection to 光标行作为插入行", () => {
		const { app, editor } = createApp({
			value: "全文不会被读取",
			selection: "选中文本",
			toLine: 5,
		});

		const result = prepareTextCommand(app as never, false);

		expect(result).not.toBeNull();
		expect(result!.target).toEqual({ text: "选中文本", insertLine: 5 });
		expect(result!.scope).toBe("选中文本");
		expect(editor.getValue).not.toHaveBeenCalled();
	});

	it("无选区时按光标所在段落取文本", () => {
		const { app } = createApp({
			value: ["第一段", "", "第二段第一行", "第二段第二行"].join("\n"),
			cursorLine: 2,
		});

		const result = prepareTextCommand(app as never, false);

		expect(result).not.toBeNull();
		expect(result!.target).toEqual({
			text: "第二段第一行\n第二段第二行",
			insertLine: 3,
		});
		expect(result!.scope).toBe("当前段落");
	});

	it("光标在空行时返回 null", () => {
		const { app } = createApp({
			value: ["第一段", "", "第二段"].join("\n"),
			cursorLine: 1,
		});

		expect(prepareTextCommand(app as never, false)).toBeNull();
		expect(noticeMock).toHaveBeenCalledWith(
			"当前段落为空，请选中文本或将光标移到段落内"
		);
	});

	it("代码块文本被拦截", () => {
		const { app } = createApp({
			value: "正文",
			selection: "```ts\nconst x = 1;\n```",
			toLine: 0,
		});

		expect(prepareTextCommand(app as never, false)).toBeNull();
		expect(noticeMock).toHaveBeenCalledWith("暂不支持处理代码块");
	});

	it("过长文本被拦截", () => {
		const { app } = createApp({
			value: "正文",
			selection: "x".repeat(5001),
			toLine: 0,
		});

		expect(prepareTextCommand(app as never, false)).toBeNull();
		expect(noticeMock).toHaveBeenCalledWith(
			"文本过长（5001 字），请控制在 5000 字以内"
		);
	});
});
