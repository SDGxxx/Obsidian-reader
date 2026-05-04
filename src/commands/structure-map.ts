import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import {
	generateStructureMap,
	MAX_DOCUMENT_LENGTH,
} from "../core/ai/structure";
import { toUserFriendlyMessage } from "../core/errors";
import { formatAsCallout } from "../core/format";
import {
	getHeadingSectionAtCursor,
	type RawSection,
	splitIntoSections,
	splitRangeIntoSections,
} from "../core/parser/sections";
import { formatStructureMapAsMarkdown } from "../core/structure-map/format";
import type {
	SectionAnalysis,
	StructureMapViewState,
} from "../types/structure";
import { SectionAction, StructureMapModal } from "../ui/structure-modal";
import type { ReadingNoteMode } from "../types/note";
import { handleGenerateReadingCheck } from "./reading-check";
import { handleGenerateReadingNote } from "./reading-note";
import { handleGenerateReadingSynthesis } from "./reading-synthesis";
import { handleSectionAction } from "./section-action";
import type { CommandRuntime } from "./runtime";

export type StructureMapCommandId =
	| "structure-map-heading"
	| "structure-map-document";

export function registerStructureMapCommands(
	plugin: Plugin,
	runtime: CommandRuntime
) {
	plugin.addCommand({
		id: "structure-map-heading",
		name: "Reader: 结构地图（当前标题）",
		callback: async () => {
			await runStructureMapCommand(plugin, runtime, "structure-map-heading");
		},
	});

	plugin.addCommand({
		id: "structure-map-document",
		name: "Reader: 结构地图（整篇文档）",
		callback: async () => {
			await runStructureMapCommand(plugin, runtime, "structure-map-document");
		},
	});
}

export async function runStructureMapCommand(
	plugin: Plugin,
	runtime: CommandRuntime,
	commandId: StructureMapCommandId
) {
	if (runtime.isProcessing()) {
		new Notice("正在处理中，请稍候");
		return;
	}

	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) {
		new Notice("未找到可用编辑器");
		return;
	}

	const fullText = view.editor.getValue();
	if (commandId === "structure-map-heading") {
		const cursorLine = view.editor.getCursor().line;
		const heading = getHeadingSectionAtCursor(fullText, cursorLine);

		if (!heading) {
			new Notice("光标不在任何标题范围内，请移到标题下方");
			return;
		}

		const rangeText = fullText
			.split("\n")
			.slice(heading.startLine, heading.endLine + 1)
			.join("\n");

		if (rangeText.length > MAX_DOCUMENT_LENGTH) {
			new Notice(
				`内容过长（${rangeText.length} 字），请控制在 ${MAX_DOCUMENT_LENGTH} 字以内`
			);
			return;
		}

		const sections = splitRangeIntoSections(
			fullText,
			heading.startLine,
			heading.endLine
		);
		if (sections.length === 0) {
			new Notice("该标题下未识别到可分析的内容");
			return;
		}

		await runStructureMap(
			plugin,
			runtime,
			view.editor,
			sections,
			heading.title,
			heading.startLine,
			heading.endLine
		);
		return;
	}

	if (!fullText.trim()) {
		new Notice("当前文档为空");
		return;
	}

	if (fullText.length > MAX_DOCUMENT_LENGTH) {
		new Notice(
			`文档过长（${fullText.length} 字），请控制在 ${MAX_DOCUMENT_LENGTH} 字以内`
		);
		return;
	}

	const sections = splitIntoSections(fullText);
	if (sections.length === 0) {
		new Notice("未识别到可分析的章节");
		return;
	}

	await runStructureMap(
		plugin,
		runtime,
		view.editor,
		sections,
		"整篇文档",
		0,
		view.editor.lineCount() - 1
	);
}

async function runStructureMap(
	plugin: Plugin,
	runtime: CommandRuntime,
	editor: Editor,
	sections: RawSection[],
	scope: string,
	insertAtLine: number,
	defaultNoteInsertLine: number
) {
	runtime.setProcessing(true);
	const loading = new Notice("正在生成结构地图...", 0);
	try {
		const result = await generateStructureMap(sections, runtime.getSettings());
		const generatedAt = new Date();
		let persistedViewState: StructureMapViewState | undefined;

		const onInsert = (currentSections: SectionAnalysis[] = result.sections) => {
			const callout = formatAsCallout(
				formatStructureMapAsMarkdown(
					{
						...result,
						sections: currentSections,
					},
					{
						scope,
						generatedAt,
					}
				),
				`结构地图 - ${scope}`
			);
			editor.replaceRange(callout + "\n\n", {
				line: insertAtLine,
				ch: 0,
			});
		};

		const onSectionAction = (sectionIndex: number, action: SectionAction) => {
			const section = sections[sectionIndex];
			if (!section) return;
			handleSectionAction(
				plugin,
				runtime,
				editor,
				section.content,
				section.endLine,
				action
			);
		};

		const onGenerateReadingNote = (
			selectedAnalyses: SectionAnalysis[],
			mode: ReadingNoteMode
		) => {
			return handleGenerateReadingNote(
				plugin,
				runtime,
				editor,
				sections,
				selectedAnalyses,
				mode,
				scope,
				defaultNoteInsertLine
			);
		};

		const onGenerateReadingCheck = (
			selectedAnalyses: SectionAnalysis[],
			mode: ReadingNoteMode
		) => {
			return handleGenerateReadingCheck(
				plugin,
				runtime,
				editor,
				sections,
				selectedAnalyses,
				mode,
				scope,
				defaultNoteInsertLine
			);
		};

		const onGenerateReadingSynthesis = (
			selectedAnalyses: SectionAnalysis[],
			mode: ReadingNoteMode
		) => {
			return handleGenerateReadingSynthesis(
				plugin,
				runtime,
				editor,
				sections,
				selectedAnalyses,
				mode,
				scope,
				defaultNoteInsertLine
			);
		};

		const openStructureMapModal = () => {
			new StructureMapModal(plugin.app, {
				scope,
				result,
				defaultReadingNoteMode: runtime.getSettings().defaultReadingNoteMode,
				initialViewState: persistedViewState,
				sectionContentLengths: Object.fromEntries(
					sections.map((section, index) => [index, section.content.length])
				),
				onPersistViewState: (state) => {
					persistedViewState = state;
				},
				onInsert,
				onSectionAction,
				onGenerateReadingNote,
				onGenerateReadingCheck,
				onGenerateReadingSynthesis,
			}).open();
		};

		runtime.setLastStructureMapSession?.({
			label: scope,
			scope,
			reopen: openStructureMapModal,
		});

		openStructureMapModal();
	} catch (e) {
		console.error("[Obsidian Reader]", e);
		new Notice(toUserFriendlyMessage(e));
	} finally {
		loading.hide();
		runtime.setProcessing(false);
	}
}
