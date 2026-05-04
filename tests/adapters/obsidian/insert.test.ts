import { describe, it, expect, vi } from "vitest";
import type { Editor } from "obsidian";
import {
	makeInsertCallback,
	makeMarkdownInsertCallback,
} from "../../../src/adapters/obsidian/insert";

function createEditor(lines: string[]) {
	const replaceRange = vi.fn();
	const editor = {
		getLine: (line: number) => lines[line],
		lineCount: () => lines.length,
		replaceRange,
	} as unknown as Editor;

	return { editor, replaceRange };
}

describe("makeInsertCallback", () => {
	it("下一行不是空行时，在原文后插入两个换行再写 callout", () => {
		const { editor, replaceRange } = createEditor(["第一行", "第二行"]);
		const insert = makeInsertCallback(editor, 0, "结果", "压缩结果");

		insert();

		expect(replaceRange).toHaveBeenCalledWith(
			"\n\n> [!summary] 压缩结果\n> 结果",
			{ line: 0, ch: 3 }
		);
	});

	it("下一行已经是空行时，只补一个换行，避免额外空白", () => {
		const { editor, replaceRange } = createEditor(["第一行", "", "第二行"]);
		const insert = makeInsertCallback(editor, 0, "结果", "展开结果");

		insert();

		expect(replaceRange).toHaveBeenCalledWith(
			"\n> [!summary] 展开结果\n> 结果",
			{ line: 0, ch: 3 }
		);
	});

	it("插入到文档最后一行时使用两个换行", () => {
		const { editor, replaceRange } = createEditor(["第一行"]);
		const insert = makeInsertCallback(editor, 0, "结果", "提问结果");

		insert();

		expect(replaceRange).toHaveBeenCalledWith(
			"\n\n> [!summary] 提问结果\n> 结果",
			{ line: 0, ch: 3 }
		);
	});
});

describe("makeMarkdownInsertCallback", () => {
	it("在原文后直接追加 Markdown，不包裹 callout", () => {
		const { editor, replaceRange } = createEditor(["第一行"]);
		const insert = makeMarkdownInsertCallback(
			editor,
			0,
			"## 读书笔记\n\n### 核心观点\n内容"
		);

		insert();

		expect(replaceRange).toHaveBeenCalledWith(
			"\n\n## 读书笔记\n\n### 核心观点\n内容",
			{ line: 0, ch: 3 }
		);
	});
});
