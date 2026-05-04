import type { StructureMapResult } from "../../types/structure";

export interface StructureMapMarkdownOptions {
	scope?: string;
	generatedAt?: Date;
}

export function formatStructureMapAsMarkdown(
	result: StructureMapResult,
	options: StructureMapMarkdownOptions = {}
): string {
	const stats = getStructureMapStats(result);
	const metaLines = [
		options.scope ? `- 分析范围：${options.scope}` : null,
		options.generatedAt
			? `- 生成时间：${formatGeneratedAt(options.generatedAt)}`
			: null,
		`- 章节统计：共 ${stats.total} 节，深读 ${stats.deep} 节，略读 ${stats.light} 节`,
	].filter((line): line is string => line !== null);
	const mapText = result.sections
		.map((section) => `- **${section.title}**（${section.tag}）：${section.summary}`)
		.join("\n");
	const highlightText = result.highlights
		.map((highlight, index) => `${index + 1}. ${highlight}`)
		.join("\n");

	return `${metaLines.join("\n")}\n\n${mapText}\n\n**最值得关注：**\n${highlightText}`;
}

export function getStructureMapStats(result: StructureMapResult) {
	const deep = result.sections.filter((section) => section.tag === "深读").length;
	const light = result.sections.length - deep;
	return {
		total: result.sections.length,
		deep,
		light,
	};
}

function formatGeneratedAt(date: Date): string {
	const pad = (value: number) => value.toString().padStart(2, "0");
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
	].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
