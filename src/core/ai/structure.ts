import type { StructureMapResult } from "../../types/structure";
import type { PluginSettings } from "../../types/compress";
import type { RawSection } from "../parser/sections";
import systemPrompt from "../../../prompts/structure-map.md";
import { createTextMessage } from "./client";
import { isRecord, parseJsonObject, stringArray } from "./parse";

/** 结构地图的文档字符数上限（高于段落操作） */
export const MAX_DOCUMENT_LENGTH = 50000;
export const STRUCTURE_MAP_MAX_TOKENS = 8192;

/**
 * 调用 Claude API 生成结构地图。
 *
 * - sections 为空时直接返回空结果
 * - secret 为空时立即抛错，不触发 SDK 调用
 */
export async function generateStructureMap(
	sections: RawSection[],
	settings: PluginSettings
): Promise<StructureMapResult> {
	if (sections.length === 0) {
		return { sections: [], highlights: [] };
	}

	// 格式化章节为编号列表
	const userMessage = sections
		.map((s, i) => `【${i + 1}】${s.title}\n${s.content}`)
		.join("\n\n---\n\n");

	const rawResult = await createTextMessage(
		settings,
		systemPrompt,
		userMessage,
		"结构地图生成失败",
		STRUCTURE_MAP_MAX_TOKENS
	);

	return parseStructureResponse(rawResult, sections);
}

/**
 * 从 Claude 返回的文本中解析 JSON 结构。
 * 容忍 markdown 代码块包裹。
 */
function parseStructureResponse(
	raw: string,
	sourceSections: RawSection[]
): StructureMapResult {
	try {
		const parsed = parseJsonObject(
			raw,
			"结构地图生成失败：返回格式无法解析"
		);

		const sectionsValue = firstArrayValue(parsed, [
			"sections",
			"章节",
			"chapters",
			"items",
			"structure",
		]);
		if (!sectionsValue) throw new Error("结构不符合预期");
		const highlightsValue =
			firstArrayValue(parsed, [
				"highlights",
				"重点",
				"最值得关注",
				"推荐",
				"recommendations",
			]) ?? [];

		return {
			sections: sectionsValue.map(
				(
					s: unknown,
					position: number
				) => {
					const section = isRecord(s) ? s : {};
					const oneBasedIndex = numberField(section, [
						"index",
						"编号",
						"章节编号",
						"sourceIndex",
						"sectionIndex",
					]);
					const sourceIndex =
						Number.isInteger(oneBasedIndex) &&
						oneBasedIndex >= 1 &&
						oneBasedIndex <= sourceSections.length
							? oneBasedIndex - 1
							: position;

					return {
						sourceIndex,
						title:
							stringField(section, ["title", "标题", "章节", "chapter"]) ||
							sourceSections[sourceIndex]?.title ||
							`章节 ${sourceIndex + 1}`,
						summary:
							stringField(section, [
								"summary",
								"核心意思",
								"摘要",
								"概括",
								"core",
							]) || summarizeLocally(sourceSections[sourceIndex]?.content || ""),
						tag: normalizeTag(stringField(section, ["tag", "建议", "阅读建议", "类型"])),
					};
				}
			),
			highlights: stringArray(highlightsValue),
		};
	} catch {
		const fallback = parseLooseStructureResponse(raw, sourceSections);
		if (fallback) return fallback;

		throw new Error(`结构地图生成失败：返回格式无法解析\n原始返回预览：${makePreview(raw)}`);
	}
}

function firstArrayValue(
	value: unknown,
	keys: string[]
): unknown[] | null {
	if (!isRecord(value)) return null;
	for (const key of keys) {
		const current = value[key];
		if (Array.isArray(current)) return current;
	}
	return null;
}

function numberField(value: Record<string, unknown>, keys: string[]): number {
	for (const key of keys) {
		const current = value[key];
		if (typeof current === "number") return current;
		const numeric = Number(current);
		if (Number.isInteger(numeric)) return numeric;
	}
	return NaN;
}

function stringField(value: Record<string, unknown>, keys: string[]): string {
	for (const key of keys) {
		const current = value[key];
		if (current !== undefined && current !== null) return String(current).trim();
	}
	return "";
}

function normalizeTag(value: string): "深读" | "略读" {
	return value.includes("深") || /deep/i.test(value) ? "深读" : "略读";
}

function parseLooseStructureResponse(
	raw: string,
	sourceSections: RawSection[]
): StructureMapResult | null {
	const lines = raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	const sections = sourceSections
		.map((sourceSection, index) => {
			const line =
				lines.find((item) => lineMentionsIndex(item, index + 1)) ||
				lines.find((item) => item.includes(sourceSection.title));
			return {
				sourceIndex: index,
				title: sourceSection.title || `章节 ${index + 1}`,
				summary: extractLooseSummary(line) || summarizeLocally(sourceSection.content),
				tag: normalizeTag(line || ""),
			};
		})
		.filter((section) => section.summary);

	if (sections.length === 0) return null;

	const highlights = lines
		.filter((line) => /值得关注|highlights?|重点|推荐/i.test(line))
		.slice(0, 3);
	return {
		sections,
		highlights:
			highlights.length > 0
				? highlights
				: sections
						.filter((section) => section.tag === "深读")
						.slice(0, 3)
						.map((section) => section.title),
	};
}

function lineMentionsIndex(line: string, index: number): boolean {
	return new RegExp(`(^|[^0-9])${index}([^0-9]|$)|【${index}】`).test(line);
}

function extractLooseSummary(line?: string): string {
	if (!line) return "";
	const withoutTable = line.replace(/^\|+|\|+$/g, "");
	const parts = withoutTable
		.split(/\||：|:| - | — |，/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (line.includes("|") && parts.length >= 4) {
		return parts[2].slice(0, 60);
	}
	const summary =
		parts.find(
			(part) =>
				!/^#?\d+$/.test(part) &&
				part !== "深读" &&
				part !== "略读" &&
				!/^标题|章节|建议|tag|summary$/i.test(part)
		) || "";
	return summary.slice(0, 60);
}

function summarizeLocally(content: string): string {
	const normalized = content.replace(/\s+/g, " ").trim();
	if (!normalized) return "未识别到核心意思";
	const sentence = normalized.split(/[。！？.!?]/)[0] || normalized;
	return sentence.slice(0, 30);
}

function makePreview(raw: string): string {
	return raw.trim().replace(/\s+/g, " ").slice(0, 240);
}
