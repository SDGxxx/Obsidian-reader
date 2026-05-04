import { describe, it, expect } from "vitest";
import { getParagraphAtCursor } from "../../../src/core/parser/paragraph";

const THREE_PARAGRAPHS = [
	"第一段第一行",
	"第一段第二行",
	"",
	"第二段第一行",
	"第二段第二行",
	"第二段第三行",
	"",
	"第三段唯一行",
].join("\n");

describe("getParagraphAtCursor", () => {
	it("正常段落：光标在中间段，返回该段文本和行号", () => {
		const result = getParagraphAtCursor(THREE_PARAGRAPHS, 3);

		expect(result).not.toBeNull();
		expect(result!.text).toBe("第二段第一行\n第二段第二行\n第二段第三行");
		expect(result!.startLine).toBe(3);
		expect(result!.endLine).toBe(5);
	});

	it("光标在空行：返回 null", () => {
		const result = getParagraphAtCursor(THREE_PARAGRAPHS, 2);

		expect(result).toBeNull();
	});

	it("单段落文档：返回全文", () => {
		const singleParagraph = "第一行\n第二行\n第三行";
		const result = getParagraphAtCursor(singleParagraph, 1);

		expect(result).not.toBeNull();
		expect(result!.text).toBe(singleParagraph);
		expect(result!.startLine).toBe(0);
		expect(result!.endLine).toBe(2);
	});

	it("光标在首段", () => {
		const result = getParagraphAtCursor(THREE_PARAGRAPHS, 0);

		expect(result).not.toBeNull();
		expect(result!.text).toBe("第一段第一行\n第一段第二行");
		expect(result!.startLine).toBe(0);
		expect(result!.endLine).toBe(1);
	});

	it("光标在末段", () => {
		const result = getParagraphAtCursor(THREE_PARAGRAPHS, 7);

		expect(result).not.toBeNull();
		expect(result!.text).toBe("第三段唯一行");
		expect(result!.startLine).toBe(7);
		expect(result!.endLine).toBe(7);
	});

	it("连续多个空行：正确识别段落边界", () => {
		const withMultipleBlankLines = [
			"段落A",
			"",
			"",
			"",
			"段落B",
		].join("\n");

		const result = getParagraphAtCursor(withMultipleBlankLines, 4);

		expect(result).not.toBeNull();
		expect(result!.text).toBe("段落B");
		expect(result!.startLine).toBe(4);
		expect(result!.endLine).toBe(4);
	});

	it("越界：负数行号返回 null", () => {
		expect(getParagraphAtCursor(THREE_PARAGRAPHS, -1)).toBeNull();
	});

	it("越界：超出文档行数返回 null", () => {
		expect(getParagraphAtCursor(THREE_PARAGRAPHS, 999)).toBeNull();
	});

	it("越界：空文档返回 null", () => {
		expect(getParagraphAtCursor("", 0)).toBeNull();
	});
});
