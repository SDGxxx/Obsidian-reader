import { Editor, Notice, Plugin } from "obsidian";
import {
	makeInsertCallback,
	makeMarkdownInsertCallback,
} from "../adapters/obsidian/insert";
import { generateReadingCheck } from "../core/ai/review";
import { toUserFriendlyMessage } from "../core/errors";
import {
	buildNoteSourceSections,
	formatList,
	getLastSelectedEndLine,
	normalizeSourceIndexes,
} from "../core/note-generation/selection";
import type { RawSection } from "../core/parser/sections";
import type { NoteSourceSection, ReadingNoteMode } from "../types/note";
import type { SectionAnalysis } from "../types/structure";
import { ResultModal } from "../ui/result-modal";
import type { CommandRuntime } from "./runtime";

export async function handleGenerateReadingCheck(
	plugin: Plugin,
	runtime: CommandRuntime,
	editor: Editor,
	rawSections: RawSection[],
	selectedAnalyses: SectionAnalysis[],
	mode: ReadingNoteMode,
	scope: string,
	defaultInsertLine: number
) {
	if (runtime.isProcessing()) {
		new Notice("正在处理中，请稍候");
		return;
	}

	const uniqueSourceIndexes = normalizeSourceIndexes(
		selectedAnalyses.map((analysis) => analysis.sourceIndex)
	);
	if (uniqueSourceIndexes.length === 0) {
		new Notice("请先勾选至少一个章节");
		return;
	}

	const noteSections = buildNoteSourceSections(
		rawSections,
		selectedAnalyses,
		uniqueSourceIndexes
	);

	if (noteSections.length === 0) {
		new Notice("未找到可生成理解检查的章节");
		return;
	}

	runtime.setProcessing(true);
	const loading = new Notice("正在生成理解检查...", 0);
	try {
		const lastSelectedLine = getLastSelectedEndLine(
			noteSections,
			rawSections,
			defaultInsertLine
		);
		await openReadingCheckResult(
			plugin,
			runtime,
			editor,
			noteSections,
			mode,
			scope,
			lastSelectedLine
		);
	} catch (e) {
		console.error("[Obsidian Reader]", e);
		new Notice(toUserFriendlyMessage(e));
	} finally {
		loading.hide();
		runtime.setProcessing(false);
	}
}

export async function handleGenerateTextReadingCheck(
	plugin: Plugin,
	runtime: CommandRuntime,
	editor: Editor,
	text: string,
	insertLine: number,
	scope: string,
	mode: ReadingNoteMode = runtime.getSettings().defaultReadingNoteMode
) {
	if (runtime.isProcessing()) {
		new Notice("正在处理中，请稍候");
		return;
	}

	runtime.setProcessing(true);
	const loading = new Notice("正在生成理解检查...", 0);
	try {
		await openReadingCheckResult(
			plugin,
			runtime,
			editor,
			[
				{
					sourceIndex: 0,
					title: scope,
					tag: "深读",
					content: text,
				},
			],
			mode,
			scope,
			insertLine
		);
	} catch (e) {
		console.error("[Obsidian Reader]", e);
		new Notice(toUserFriendlyMessage(e));
	} finally {
		loading.hide();
		runtime.setProcessing(false);
	}
}

async function openReadingCheckResult(
	plugin: Plugin,
	runtime: CommandRuntime,
	editor: Editor,
	noteSections: NoteSourceSection[],
	mode: ReadingNoteMode,
	scope: string,
	insertLine: number
) {
	const result = await generateReadingCheck(noteSections, runtime.getSettings(), {
		mode,
	});
	const onInsert = makeInsertCallback(
		editor,
		insertLine,
		result.markdown,
		`理解检查 — ${scope}`
	);
	const onInsertMarkdown = makeMarkdownInsertCallback(
		editor,
		insertLine,
		result.markdown
	);
	new ResultModal(plugin.app, {
		title: "理解检查",
		scope,
		sections: [
			{ label: "检查档位", text: modeLabel(mode) },
			{ label: "来源章节", text: formatList(result.sourceTitles) },
			{ label: "核心理解", text: result.summary },
			{ label: "关键核对点", text: formatList(result.checkpoints) },
			{ label: "容易误解的地方", text: formatList(result.blindSpots) },
			{ label: "追问问题", text: formatList(result.questions) },
			{ label: "Markdown", text: result.markdown },
		],
		copyText: result.markdown,
		onInsert,
		onInsertMarkdown,
	}).open();
}

function modeLabel(mode: ReadingNoteMode): string {
	if (mode === "light") return "轻量";
	if (mode === "deep") return "深度";
	return "标准";
}
