import { describe, it, expect } from "vitest";
import {
	formatStructureMapAsMarkdown,
	getStructureMapStats,
} from "../../../src/core/structure-map/format";

describe("formatStructureMapAsMarkdown", () => {
	it("格式化章节和重点推荐", () => {
		const result = formatStructureMapAsMarkdown(
			{
				sections: [
					{
						sourceIndex: 0,
						title: "引言",
						summary: "介绍背景",
						tag: "略读",
					},
					{
						sourceIndex: 1,
						title: "核心论点",
						summary: "提出关键观点",
						tag: "深读",
					},
				],
				highlights: ["核心论点", "结论"],
			},
			{
				scope: "整篇文档",
				generatedAt: new Date(2026, 4, 3, 9, 8),
			}
		);

		expect(result).toBe(
			[
				"- 分析范围：整篇文档",
				"- 生成时间：2026-05-03 09:08",
				"- 章节统计：共 2 节，深读 1 节，略读 1 节",
				"",
				"- **引言**（略读）：介绍背景",
				"- **核心论点**（深读）：提出关键观点",
				"",
				"**最值得关注：**",
				"1. 核心论点",
				"2. 结论",
			].join("\n")
		);
	});

	it("统计章节总数和深读/略读数量", () => {
		expect(
			getStructureMapStats({
				sections: [
					{ sourceIndex: 0, title: "A", summary: "A", tag: "深读" },
					{ sourceIndex: 1, title: "B", summary: "B", tag: "略读" },
					{ sourceIndex: 2, title: "C", summary: "C", tag: "略读" },
				],
				highlights: [],
			})
		).toEqual({
			total: 3,
			deep: 1,
			light: 2,
		});
	});
});
