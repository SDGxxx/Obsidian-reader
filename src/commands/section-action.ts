import { Editor, Notice, Plugin } from "obsidian";
import { makeInsertCallback } from "../adapters/obsidian/insert";
import { askText } from "../core/ai/ask";
import { compressText } from "../core/ai/compress";
import { expandText } from "../core/ai/expand";
import { toUserFriendlyMessage } from "../core/errors";
import { handleGenerateTextReadingCheck } from "./reading-check";
import { AskInputModal } from "../ui/ask-input-modal";
import { ResultModal } from "../ui/result-modal";
import type { SectionAction } from "../ui/structure-modal";
import type { CommandRuntime } from "./runtime";

export function handleSectionAction(
	plugin: Plugin,
	runtime: CommandRuntime,
	editor: Editor,
	sectionText: string,
	insertLine: number,
	action: SectionAction
) {
	if (runtime.isProcessing()) {
		new Notice("正在处理中，请稍候");
		return;
	}

	if (action === "ask") {
		handleAskSection(plugin, runtime, editor, sectionText, insertLine);
		return;
	}
	if (action === "check") {
		void handleCheckSection(
			plugin,
			runtime,
			editor,
			sectionText,
			insertLine
		);
		return;
	}

	void handleTransformSection(
		plugin,
		runtime,
		editor,
		sectionText,
		insertLine,
		action
	);
}

function handleAskSection(
	plugin: Plugin,
	runtime: CommandRuntime,
	editor: Editor,
	sectionText: string,
	insertLine: number
) {
	new AskInputModal(plugin.app, async (question) => {
		runtime.setProcessing(true);
		const loading = new Notice("正在回答...", 0);
		try {
			const result = await askText(sectionText, question, runtime.getSettings());
			const onInsert = makeInsertCallback(
				editor,
				insertLine,
				`**Q: ${result.question}**\n\n${result.answer}`,
				"提问结果"
			);
			new ResultModal(plugin.app, {
				title: "提问结果",
				scope: "章节内容",
				sections: [
					{ label: "原文", text: result.original },
					{ label: "问题", text: result.question },
					{ label: "回答", text: result.answer },
				],
				copyText: result.answer,
				onInsert,
			}).open();
		} catch (e) {
			console.error("[Obsidian Reader]", e);
			new Notice(toUserFriendlyMessage(e));
		} finally {
			loading.hide();
			runtime.setProcessing(false);
		}
	}).open();
}

async function handleTransformSection(
	plugin: Plugin,
	runtime: CommandRuntime,
	editor: Editor,
	sectionText: string,
	insertLine: number,
	action: Exclude<SectionAction, "ask">
) {
	runtime.setProcessing(true);
	const label = action === "compress" ? "压缩" : "展开";
	const loading = new Notice(`正在${label}...`, 0);
	try {
		if (action === "compress") {
			const result = await compressText(sectionText, runtime.getSettings());
			const onInsert = makeInsertCallback(
				editor,
				insertLine,
				result.compressed,
				"压缩结果"
			);
			new ResultModal(plugin.app, {
				title: "压缩结果",
				scope: "章节内容",
				sections: [
					{ label: "原文", text: result.original },
					{ label: "压缩后", text: result.compressed },
					{ label: "压缩比", text: `${Math.round(result.ratio * 100)}%` },
				],
				copyText: result.compressed,
				onInsert,
			}).open();
		} else {
			const result = await expandText(sectionText, runtime.getSettings());
			const onInsert = makeInsertCallback(
				editor,
				insertLine,
				result.expanded,
				"展开结果"
			);
			new ResultModal(plugin.app, {
				title: "展开结果",
				scope: "章节内容",
				sections: [
					{ label: "原文", text: result.original },
					{ label: "展开后", text: result.expanded },
				],
				copyText: result.expanded,
				onInsert,
			}).open();
		}
	} catch (e) {
		console.error("[Obsidian Reader]", e);
		new Notice(toUserFriendlyMessage(e));
	} finally {
		loading.hide();
		runtime.setProcessing(false);
	}
}

async function handleCheckSection(
	plugin: Plugin,
	runtime: CommandRuntime,
	editor: Editor,
	sectionText: string,
	insertLine: number
) {
	await handleGenerateTextReadingCheck(
		plugin,
		runtime,
		editor,
		sectionText,
		insertLine,
		"当前章节"
	);
}
