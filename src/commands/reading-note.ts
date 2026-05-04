import { Editor, Notice, Plugin } from "obsidian";
import { makeInsertCallback, makeMarkdownInsertCallback } from "../adapters/obsidian/insert";
import { generateReadingNote } from "../core/ai/note";
import { toUserFriendlyMessage } from "../core/errors";
import {
	buildNoteSourceSections,
	formatList,
	getLastSelectedEndLine,
	normalizeSourceIndexes,
} from "../core/note-generation/selection";
import type { RawSection } from "../core/parser/sections";
import type { ReadingNoteMode } from "../types/note";
import type { SectionAnalysis } from "../types/structure";
import { ResultModal } from "../ui/result-modal";
import type { CommandRuntime } from "./runtime";

export async function handleGenerateReadingNote(
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
		new Notice("未找到可生成笔记的章节");
		return;
	}

	runtime.setProcessing(true);
	const loading = new Notice("正在生成读书笔记...", 0);
	try {
		const result = await generateReadingNote(noteSections, runtime.getSettings(), {
			mode,
		});
		const lastSelectedLine = getLastSelectedEndLine(
			noteSections,
			rawSections,
			defaultInsertLine
		);
		const onInsert = makeInsertCallback(
			editor,
			lastSelectedLine,
			result.markdown,
			`读书笔记 — ${scope}`
		);
		const onInsertMarkdown = makeMarkdownInsertCallback(
			editor,
			lastSelectedLine,
			result.markdown
		);
		new ResultModal(plugin.app, {
			title: "读书笔记",
			scope,
			sections: [
				{ label: "笔记档位", text: modeLabel(mode) },
				{ label: "来源章节", text: formatList(result.sourceTitles) },
				{ label: "核心观点", text: result.summary },
				{
					label: "值得记住的点",
					text: formatList(result.memorablePoints),
				},
				{ label: "可连接旧知", text: formatList(result.connections) },
				{ label: "待追问问题", text: formatList(result.questions) },
				{ label: "Markdown", text: result.markdown },
			],
			copyText: result.markdown,
			onInsert,
			onInsertMarkdown,
		}).open();
	} catch (e) {
		console.error("[Obsidian Reader]", e);
		new Notice(toUserFriendlyMessage(e));
	} finally {
		loading.hide();
		runtime.setProcessing(false);
	}
}

function modeLabel(mode: ReadingNoteMode): string {
	if (mode === "light") return "轻量";
	if (mode === "deep") return "深度";
	return "标准";
}
