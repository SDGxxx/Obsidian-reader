import type { PluginSettings } from "../../types/compress";
import {
	READING_NOTE_MODE_LABELS,
	type NoteSourceSection,
	type ReadingNoteMode,
} from "../../types/note";
import type {
	GenerateReadingCheckOptions,
	ReadingCheckResult,
} from "../../types/review";
import systemPrompt from "../../../prompts/reading-check.md";
import { MAX_READING_NOTE_INPUT_LENGTH } from "../note-generation/limits";
import { createTextMessage } from "./client";
import { isRecord, parseJsonObject, stringArray } from "./parse";

/**
 * 调用 Claude API 基于用户选择的章节生成理解检查卡。
 */
export async function generateReadingCheck(
	sections: NoteSourceSection[],
	settings: PluginSettings,
	options: GenerateReadingCheckOptions = {}
): Promise<ReadingCheckResult> {
	if (sections.length === 0) {
		throw new Error("请先选择至少一个章节");
	}

	const totalContentLength = sections.reduce(
		(total, section) => total + section.content.length,
		0
	);
	if (totalContentLength > MAX_READING_NOTE_INPUT_LENGTH) {
		throw new Error(
			`已选章节过长（${totalContentLength} 字），请减少勾选章节或改为分批生成（上限 ${MAX_READING_NOTE_INPUT_LENGTH} 字）`
		);
	}

	const mode = options.mode ?? "standard";
	const userMessage = sections
		.map(
			(section, index) =>
				`【${index + 1}】${section.title}\n阅读建议：${section.tag}\n原文下标：${section.sourceIndex}\n${section.content.trim()}`
		)
		.join("\n\n---\n\n");

	const rawResult = await createTextMessage(
		settings,
		systemPrompt,
		`检查档位：${READING_NOTE_MODE_LABELS[mode]}\n\n${userMessage}`,
		"理解检查生成失败"
	);

	const parsed = parseReadingCheckResponse(rawResult);
	const sourceTitles = sections.map((section) => section.title);
	const markdown = normalizeReadingCheckMarkdown(parsed, sections, mode);
	return {
		...parsed,
		mode,
		sourceTitles,
		markdown: addReadingCheckTrace(markdown, sections, mode),
	};
}

function parseReadingCheckResponse(
	raw: string
): Omit<ReadingCheckResult, "mode" | "sourceTitles"> {
	try {
		const parsed = parseJsonObject(
			raw,
			"理解检查生成失败：返回格式无法解析"
		);
		if (
			!isRecord(parsed) ||
			typeof parsed.summary !== "string" ||
			!Array.isArray(parsed.checkpoints) ||
			!Array.isArray(parsed.blindSpots) ||
			!Array.isArray(parsed.questions) ||
			typeof parsed.markdown !== "string"
		) {
			throw new Error("结构不符合预期");
		}

		const result: Omit<ReadingCheckResult, "mode" | "sourceTitles"> = {
			summary: parsed.summary.trim(),
			checkpoints: stringArray(parsed.checkpoints),
			blindSpots: stringArray(parsed.blindSpots),
			questions: stringArray(parsed.questions),
			markdown: parsed.markdown.trim(),
		};

		if (!result.markdown) {
			throw new Error("markdown 为空");
		}

		return result;
	} catch {
		const partial = partialReadingCheckFromJson(raw);
		if (partial) return partial;
		return fallbackReadingCheckFromRaw(raw);
	}
}

function partialReadingCheckFromJson(
	raw: string
): Omit<ReadingCheckResult, "mode" | "sourceTitles"> | null {
	const parsed = tryParseJsonObject(raw);
	if (!parsed) return null;

	const summary = optionalString(parsed.summary);
	const checkpoints = stringArray(parsed.checkpoints);
	const blindSpots = stringArray(parsed.blindSpots);
	const questions = stringArray(parsed.questions);
	const markdown = optionalString(parsed.markdown);

	if (!summary && checkpoints.length === 0 && questions.length === 0) {
		return null;
	}

	return {
		summary: summary || "模型返回了不完整的理解检查，已基于可用字段补齐。",
		checkpoints,
		blindSpots,
		questions,
		markdown,
	};
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
	try {
		const parsed = parseJsonObject(raw, "");
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function optionalString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function fallbackReadingCheckFromRaw(
	raw: string
): Omit<ReadingCheckResult, "mode" | "sourceTitles"> {
	const markdown = raw.trim() || "模型未返回可解析内容。";
	const bullets = extractMarkdownBullets(markdown);
	return {
		summary: firstMeaningfulLine(markdown),
		checkpoints: bullets.slice(0, 5),
		blindSpots: [],
		questions: extractQuestionLines(markdown),
		markdown,
	};
}

function normalizeReadingCheckMarkdown(
	result: Omit<ReadingCheckResult, "mode" | "sourceTitles">,
	sections: NoteSourceSection[],
	mode: ReadingNoteMode
): string {
	const markdown = result.markdown.trim();
	if (hasExpectedMarkdownStructure(markdown)) {
		return markdown;
	}

	return [
		"## 理解检查",
		"",
		`> 生成模式：${READING_NOTE_MODE_LABELS[mode]}`,
		`> 选中章节：${sections.map((section) => section.title).join("、")}`,
		"",
		"### 核心理解",
		result.summary || "无",
		"",
		"### 关键核对点",
		formatMarkdownList(result.checkpoints),
		"",
		"### 容易误解的地方",
		formatMarkdownList(result.blindSpots),
		"",
		"### 追问问题",
		formatMarkdownList(result.questions),
	].join("\n");
}

function hasExpectedMarkdownStructure(markdown: string): boolean {
	return (
		/^##\s+理解检查/m.test(markdown) &&
		/^###\s+核心理解/m.test(markdown) &&
		/^###\s+关键核对点/m.test(markdown) &&
		/^###\s+容易误解的地方/m.test(markdown) &&
		/^###\s+追问问题/m.test(markdown)
	);
}

function formatMarkdownList(items: string[]): string {
	if (items.length === 0) return "- 无";
	return items.map((item) => `- ${item}`).join("\n");
}

function firstMeaningfulLine(markdown: string): string {
	const line =
		markdown
			.split(/\r?\n/)
			.map((item) => item.replace(/^#+\s*/, "").trim())
			.find((item) => item && !/^```/.test(item)) || "";
	return line.slice(0, 160) || "模型返回了非标准格式，已作为 Markdown 兜底处理。";
}

function extractMarkdownBullets(markdown: string): string[] {
	return markdown
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => /^[-*]\s+/.test(line))
		.map((line) => line.replace(/^[-*]\s+/, ""))
		.slice(0, 8);
}

function extractQuestionLines(markdown: string): string[] {
	return markdown
		.split(/\r?\n/)
		.map((line) => line.trim().replace(/^[-*]\s+/, ""))
		.filter((line) => /[？?]$/.test(line))
		.slice(0, 5);
}

function addReadingCheckTrace(
	markdown: string,
	sections: NoteSourceSection[],
	mode: ReadingNoteMode
): string {
	const traceLines = [
		`> 检查档位：${READING_NOTE_MODE_LABELS[mode]}`,
		"> 来源章节：",
		...sections.map(
			(section) => `> - ${section.title}（${section.tag}，原文 #${section.sourceIndex + 1}）`
		),
	];

	return `${markdown.trim()}\n\n${traceLines.join("\n")}`;
}
