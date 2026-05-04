import { Editor, Notice, Plugin } from "obsidian";
import { makeMarkdownInsertCallback } from "../adapters/obsidian/insert";
import { generateReadingCheck } from "../core/ai/review";
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

export async function handleGenerateReadingSynthesis(
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
		new Notice("未找到可生成读后沉淀的章节");
		return;
	}

	runtime.setProcessing(true);
	const loading = new Notice("正在生成读后沉淀...", 0);
	try {
		const checkResult = await generateReadingCheck(
			noteSections,
			runtime.getSettings(),
			{ mode }
		);
		const noteResult = await generateReadingNote(
			noteSections,
			runtime.getSettings(),
			{
				mode,
				readingCheckContext: {
					summary: checkResult.summary,
					checkpoints: checkResult.checkpoints,
					blindSpots: checkResult.blindSpots,
					questions: checkResult.questions,
				},
			}
		);
		const lastSelectedLine = getLastSelectedEndLine(
			noteSections,
			rawSections,
			defaultInsertLine
		);
		const markdown = formatReadingSynthesisMarkdown(
			checkResult.markdown,
			noteResult.markdown
		);
		const onInsertMarkdown = makeMarkdownInsertCallback(
			editor,
			lastSelectedLine,
			markdown
		);
		new ResultModal(plugin.app, {
			title: "读后沉淀",
			scope,
			sections: [
				{ label: "理解检查档位", text: modeLabel(mode) },
				{ label: "理解检查", text: checkResult.summary },
				{ label: "关键核对点", text: formatList(checkResult.checkpoints) },
				{ label: "容易误解的地方", text: formatList(checkResult.blindSpots) },
				{ label: "读书笔记档位", text: modeLabel(mode) },
				{ label: "读书笔记", text: noteResult.summary },
				{
					label: "值得记住的点",
					text: formatList(noteResult.memorablePoints),
				},
				{ label: "Markdown", text: markdown },
			],
			copyText: markdown,
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

function formatReadingSynthesisMarkdown(
	checkMarkdown: string,
	noteMarkdown: string
): string {
	return [checkMarkdown.trim(), noteMarkdown.trim()].join("\n\n---\n\n");
}

function modeLabel(mode: ReadingNoteMode): string {
	if (mode === "light") return "轻量";
	if (mode === "deep") return "深度";
	return "标准";
}
