import type { PluginSettings } from "../../types/compress";
import {
	READING_NOTE_MODE_LABELS,
	type ReadingCheckContext,
	type GenerateReadingNoteOptions,
	type NoteSourceSection,
	type ReadingNoteMode,
	type ReadingNoteResult,
} from "../../types/note";
import systemPrompt from "../../../prompts/reading-note.md";
import { MAX_READING_NOTE_INPUT_LENGTH } from "../note-generation/limits";
import { createTextMessage } from "./client";
import { isRecord, parseJsonObject, stringArray } from "./parse";

/**
 * 调用 Claude API 基于用户选择的章节生成结构化读书笔记。
 */
export async function generateReadingNote(
	sections: NoteSourceSection[],
	settings: PluginSettings,
	options: GenerateReadingNoteOptions = {}
): Promise<ReadingNoteResult> {
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
	const readingCheckContext = options.readingCheckContext
		? formatReadingCheckContext(options.readingCheckContext)
		: "";

	const rawResult = await createTextMessage(
		settings,
		systemPrompt,
		[
			`笔记档位：${READING_NOTE_MODE_LABELS[mode]}`,
			readingCheckContext,
			userMessage,
		]
			.filter(Boolean)
			.join("\n\n"),
		"读书笔记生成失败"
	);

	const parsed = parseReadingNoteResponse(rawResult);
	const sourceTitles = sections.map((section) => section.title);
	const markdown = normalizeReadingNoteMarkdown(parsed, sections, mode);
	return {
		...parsed,
		mode,
		sourceTitles,
		markdown: addReadingNoteTrace(markdown, sections, mode),
	};
}

function parseReadingNoteResponse(
	raw: string
): Omit<ReadingNoteResult, "mode" | "sourceTitles"> {
	try {
		const parsed = parseJsonObject(
			raw,
			"读书笔记生成失败：返回格式无法解析"
		);
		if (
			!isRecord(parsed) ||
			typeof parsed.summary !== "string" ||
			!Array.isArray(parsed.memorablePoints) ||
			!Array.isArray(parsed.connections) ||
			!Array.isArray(parsed.questions) ||
			typeof parsed.markdown !== "string"
		) {
			throw new Error("结构不符合预期");
		}

		const result: Omit<ReadingNoteResult, "mode" | "sourceTitles"> = {
			summary: parsed.summary.trim(),
			memorablePoints: stringArray(parsed.memorablePoints),
			connections: stringArray(parsed.connections),
			questions: stringArray(parsed.questions),
			markdown: parsed.markdown.trim(),
		};

		if (!result.markdown) {
			throw new Error("markdown 为空");
		}

		return result;
	} catch {
		const partial = partialReadingNoteFromJson(raw);
		if (partial) return partial;
		return fallbackReadingNoteFromRaw(raw);
	}
}

function partialReadingNoteFromJson(
	raw: string
): Omit<ReadingNoteResult, "mode" | "sourceTitles"> | null {
	const parsed = tryParseJsonObject(raw);
	if (!parsed) return null;

	const summary = optionalString(parsed.summary);
	const memorablePoints = stringArray(parsed.memorablePoints);
	const connections = stringArray(parsed.connections);
	const questions = stringArray(parsed.questions);
	const markdown = optionalString(parsed.markdown);

	if (!summary && memorablePoints.length === 0 && questions.length === 0) {
		return null;
	}

	return {
		summary: summary || "模型返回了不完整的读书笔记，已基于可用字段补齐。",
		memorablePoints,
		connections,
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

function fallbackReadingNoteFromRaw(
	raw: string
): Omit<ReadingNoteResult, "mode" | "sourceTitles"> {
	const markdown = raw.trim() || "模型未返回可解析内容。";
	const bullets = extractMarkdownBullets(markdown);
	return {
		summary: firstMeaningfulLine(markdown),
		memorablePoints: bullets.slice(0, 5),
		connections: [],
		questions: extractQuestionLines(markdown),
		markdown,
	};
}

function normalizeReadingNoteMarkdown(
	note: Omit<ReadingNoteResult, "mode" | "sourceTitles">,
	sections: NoteSourceSection[],
	mode: ReadingNoteMode
): string {
	const markdown = note.markdown.trim();
	if (hasExpectedMarkdownStructure(markdown)) {
		return markdown;
	}

	return [
		"## 读书笔记",
		"",
		`> 生成模式：${READING_NOTE_MODE_LABELS[mode]}`,
		`> 选中章节：${sections.map((section) => section.title).join("、")}`,
		"",
		"### 核心观点",
		note.summary || "无",
		"",
		"### 值得记住的点",
		formatMarkdownList(note.memorablePoints),
		"",
		"### 可连接旧知",
		formatMarkdownList(note.connections),
		"",
		"### 待追问问题",
		formatMarkdownList(note.questions),
	].join("\n");
}

function hasExpectedMarkdownStructure(markdown: string): boolean {
	return (
		/^##\s+读书笔记/m.test(markdown) &&
		/^###\s+核心观点/m.test(markdown) &&
		/^###\s+值得记住的点/m.test(markdown) &&
		/^###\s+可连接旧知/m.test(markdown) &&
		/^###\s+待追问问题/m.test(markdown)
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

function addReadingNoteTrace(
	markdown: string,
	sections: NoteSourceSection[],
	mode: ReadingNoteMode
): string {
	const traceLines = [
		`> 笔记档位：${READING_NOTE_MODE_LABELS[mode]}`,
		"> 来源章节：",
		...sections.map(
			(section) => `> - ${section.title}（${section.tag}，原文 #${section.sourceIndex + 1}）`
		),
	];

	return `${markdown.trim()}\n\n${traceLines.join("\n")}`;
}

function formatReadingCheckContext(context: ReadingCheckContext): string {
	const formatList = (items: string[]) =>
		items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- 无";

	return [
		"前置理解检查：",
		`核心理解：${context.summary || "无"}`,
		"关键核对点：",
		formatList(context.checkpoints),
		"容易误解的地方：",
		formatList(context.blindSpots),
		"追问问题：",
		formatList(context.questions),
	].join("\n");
}
