import { describe, it, expect } from "vitest";
import {
	splitIntoSections,
	getHeadingSectionAtCursor,
	splitRangeIntoSections,
} from "../../../src/core/parser/sections";

describe("splitIntoSections", () => {
	it("按标题切分：正确识别多个章节", () => {
		const text = [
			"# 引言",
			"这是引言内容。",
			"",
			"## 第一章",
			"第一章内容。",
			"",
			"## 第二章",
			"第二章内容。",
		].join("\n");

		const result = splitIntoSections(text);

		expect(result).toHaveLength(3);
		expect(result[0].title).toBe("引言");
		expect(result[1].title).toBe("第一章");
		expect(result[2].title).toBe("第二章");
		expect(result[1].content).toBe("第一章内容。");
	});

	it("标题前有内容：生成引言段", () => {
		const text = [
			"这是标题前的内容。",
			"",
			"# 正文",
			"正文内容。",
		].join("\n");

		const result = splitIntoSections(text);

		expect(result).toHaveLength(2);
		expect(result[0].title).toBe("引言");
		expect(result[0].content).toBe("这是标题前的内容。");
		expect(result[1].title).toBe("正文");
	});

	it("无标题文档：按空行分段", () => {
		const text = [
			"第一段内容。",
			"第一段第二行。",
			"",
			"第二段内容。",
			"",
			"第三段内容。",
		].join("\n");

		const result = splitIntoSections(text);

		expect(result).toHaveLength(3);
		expect(result[0].title).toBe("段落 1");
		expect(result[1].title).toBe("段落 2");
		expect(result[2].title).toBe("段落 3");
	});

	it("空文档：返回空数组", () => {
		expect(splitIntoSections("")).toHaveLength(0);
	});

	it("单行文档无标题：返回一个段落", () => {
		const result = splitIntoSections("唯一的一行");

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("段落 1");
		expect(result[0].content).toBe("唯一的一行");
	});

	it("行号正确", () => {
		const text = [
			"# A",     // 0
			"内容A",   // 1
			"# B",     // 2
			"内容B",   // 3
		].join("\n");

		const result = splitIntoSections(text);

		expect(result[0].startLine).toBe(0);
		expect(result[0].endLine).toBe(1);
		expect(result[1].startLine).toBe(2);
		expect(result[1].endLine).toBe(3);
	});
});

const MULTI_LEVEL_DOC = [
	"# 第一章",        // 0
	"第一章内容",       // 1
	"## 1.1 节",       // 2
	"1.1 内容",        // 3
	"## 1.2 节",       // 4
	"1.2 内容",        // 5
	"# 第二章",        // 6
	"第二章内容",       // 7
].join("\n");

describe("getHeadingSectionAtCursor", () => {
	it("光标在 ## 标题下：返回该 ## 范围", () => {
		const result = getHeadingSectionAtCursor(MULTI_LEVEL_DOC, 3);

		expect(result).not.toBeNull();
		expect(result!.title).toBe("1.1 节");
		expect(result!.startLine).toBe(2);
		expect(result!.endLine).toBe(3);
	});

	it("光标在 # 标题下：返回到下一个 # 之前", () => {
		const result = getHeadingSectionAtCursor(MULTI_LEVEL_DOC, 1);

		expect(result).not.toBeNull();
		expect(result!.title).toBe("第一章");
		expect(result!.startLine).toBe(0);
		expect(result!.endLine).toBe(5);
	});

	it("光标在最后一个 # 下：延伸到文档末尾", () => {
		const result = getHeadingSectionAtCursor(MULTI_LEVEL_DOC, 7);

		expect(result).not.toBeNull();
		expect(result!.title).toBe("第二章");
		expect(result!.startLine).toBe(6);
		expect(result!.endLine).toBe(7);
	});

	it("无标题文档：返回 null", () => {
		const result = getHeadingSectionAtCursor("一段普通文本", 0);
		expect(result).toBeNull();
	});

	it("越界行号：返回 null", () => {
		expect(getHeadingSectionAtCursor(MULTI_LEVEL_DOC, -1)).toBeNull();
		expect(getHeadingSectionAtCursor(MULTI_LEVEL_DOC, 999)).toBeNull();
	});
});

describe("splitRangeIntoSections", () => {
	it("对指定范围做子切分，行号含偏移", () => {
		// 取 "# 第一章" (0-5) 范围
		const sections = splitRangeIntoSections(MULTI_LEVEL_DOC, 0, 5);

		expect(sections.length).toBeGreaterThanOrEqual(2);
		// 行号应该是原文中的绝对行号
		expect(sections[0].startLine).toBe(0);
		expect(sections[sections.length - 1].endLine).toBeLessThanOrEqual(5);
	});
});
