import { describe, it, expect } from "vitest";
import type { RawSection } from "../../../src/core/parser/sections";
import {
	buildNoteSourceSections,
	formatList,
	getLastSelectedEndLine,
	normalizeSourceIndexes,
} from "../../../src/core/note-generation/selection";
import type { SectionAnalysis } from "../../../src/types/structure";

const RAW_SECTIONS: RawSection[] = [
	{ title: "原始引言", content: "背景内容", startLine: 0, endLine: 2 },
	{ title: "原始论点", content: "论点内容", startLine: 3, endLine: 8 },
	{ title: "原始例子", content: "例子内容", startLine: 9, endLine: 12 },
];

const ANALYSES: SectionAnalysis[] = [
	{ sourceIndex: 0, title: "引言", summary: "背景", tag: "略读" },
	{ sourceIndex: 1, title: "", summary: "论点", tag: "深读" },
	{ sourceIndex: 2, title: "例子", summary: "例子", tag: "略读" },
];

describe("normalizeSourceIndexes", () => {
	it("去重并升序排序", () => {
		expect(normalizeSourceIndexes([2, 1, 2, 0])).toEqual([0, 1, 2]);
	});
});

describe("buildNoteSourceSections", () => {
	it("按 sourceIndex 构造读书笔记输入章节", () => {
		const result = buildNoteSourceSections(RAW_SECTIONS, ANALYSES, [1, 0]);

		expect(result).toEqual([
			{
				sourceIndex: 0,
				title: "引言",
				tag: "略读",
				content: "背景内容",
			},
			{
				sourceIndex: 1,
				title: "原始论点",
				tag: "深读",
				content: "论点内容",
			},
		]);
	});

	it("过滤无 raw section 或无 analysis 的下标", () => {
		const result = buildNoteSourceSections(RAW_SECTIONS, ANALYSES, [1, 99]);

		expect(result).toHaveLength(1);
		expect(result[0].sourceIndex).toBe(1);
	});
});

describe("getLastSelectedEndLine", () => {
	it("返回已选章节的最大结束行", () => {
		const noteSections = buildNoteSourceSections(
			RAW_SECTIONS,
			ANALYSES,
			[0, 2]
		);

		expect(getLastSelectedEndLine(noteSections, RAW_SECTIONS, 0)).toBe(12);
	});

	it("无章节时回退到默认插入行", () => {
		expect(getLastSelectedEndLine([], RAW_SECTIONS, 7)).toBe(7);
	});
});

describe("formatList", () => {
	it("空数组显示无", () => {
		expect(formatList([])).toBe("无");
	});

	it("数组格式化为 markdown bullet", () => {
		expect(formatList(["A", "B"])).toBe("- A\n- B");
	});
});
