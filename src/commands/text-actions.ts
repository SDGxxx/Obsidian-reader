import { Notice, Plugin } from "obsidian";
import { askText } from "../core/ai/ask";
import { compressText } from "../core/ai/compress";
import { expandText } from "../core/ai/expand";
import { toUserFriendlyMessage } from "../core/errors";
import { makeInsertCallback } from "../adapters/obsidian/insert";
import { prepareTextCommand } from "../adapters/obsidian/text-command";
import { AskInputModal } from "../ui/ask-input-modal";
import { ResultModal } from "../ui/result-modal";
import { handleGenerateTextReadingCheck } from "./reading-check";
import { handleGenerateReadingSynthesis } from "./reading-synthesis";
import type { CommandRuntime } from "./runtime";

export type TextActionCommandId =
	| "compress-selection"
	| "expand-selection"
	| "ask-selection"
	| "reading-check-selection"
	| "reading-synthesis-selection";

export function registerTextActionCommands(
	plugin: Plugin,
	runtime: CommandRuntime
) {
	plugin.addCommand({
		id: "compress-selection",
		name: "Reader: 压缩",
		callback: () => {
			void runTextActionCommand(plugin, runtime, "compress-selection");
		},
	});

	plugin.addCommand({
		id: "expand-selection",
		name: "Reader: 展开",
		callback: () => {
			void runTextActionCommand(plugin, runtime, "expand-selection");
		},
	});

	plugin.addCommand({
		id: "ask-selection",
		name: "Reader: 提问",
		callback: () => {
			void runTextActionCommand(plugin, runtime, "ask-selection");
		},
	});

	plugin.addCommand({
		id: "reading-check-selection",
		name: "Reader: 理解检查",
		callback: () => {
			void runTextActionCommand(plugin, runtime, "reading-check-selection");
		},
	});

	plugin.addCommand({
		id: "reading-synthesis-selection",
		name: "Reader: 读后沉淀",
		callback: () => {
			void runTextActionCommand(plugin, runtime, "reading-synthesis-selection");
		},
	});
}

export async function runTextActionCommand(
	plugin: Plugin,
	runtime: CommandRuntime,
	commandId: TextActionCommandId
) {
	const ctx = prepareTextCommand(plugin.app, runtime.isProcessing());
	if (!ctx) return;

	if (commandId === "compress-selection") {
		runtime.setProcessing(true);
		const loading = new Notice("正在压缩...", 0);
		try {
			const result = await compressText(ctx.target.text, runtime.getSettings());
			const onInsert = makeInsertCallback(
				ctx.editor,
				ctx.target.insertLine,
				result.compressed,
				"压缩结果"
			);
			new ResultModal(plugin.app, {
				title: "压缩结果",
				scope: ctx.scope,
				sections: [
					{ label: "原文", text: result.original },
					{ label: "压缩后", text: result.compressed },
					{ label: "压缩比", text: `${Math.round(result.ratio * 100)}%` },
				],
				copyText: result.compressed,
				onInsert,
			}).open();
		} catch (e) {
			console.error("[Obsidian Reader]", e);
			new Notice(toUserFriendlyMessage(e));
		} finally {
			loading.hide();
			runtime.setProcessing(false);
		}
		return;
	}

	if (commandId === "expand-selection") {
		runtime.setProcessing(true);
		const loading = new Notice("正在展开...", 0);
		try {
			const result = await expandText(ctx.target.text, runtime.getSettings());
			const onInsert = makeInsertCallback(
				ctx.editor,
				ctx.target.insertLine,
				result.expanded,
				"展开结果"
			);
			new ResultModal(plugin.app, {
				title: "展开结果",
				scope: ctx.scope,
				sections: [
					{ label: "原文", text: result.original },
					{ label: "展开后", text: result.expanded },
				],
				copyText: result.expanded,
				onInsert,
			}).open();
		} catch (e) {
			console.error("[Obsidian Reader]", e);
			new Notice(toUserFriendlyMessage(e));
		} finally {
			loading.hide();
			runtime.setProcessing(false);
		}
		return;
	}

	if (commandId === "ask-selection") {
		new AskInputModal(plugin.app, async (question) => {
			runtime.setProcessing(true);
			const loading = new Notice("正在回答...", 0);
			try {
				const result = await askText(
					ctx.target.text,
					question,
					runtime.getSettings()
				);
				const onInsert = makeInsertCallback(
					ctx.editor,
					ctx.target.insertLine,
					`**Q: ${result.question}**\n\n${result.answer}`,
					"提问结果"
				);
				new ResultModal(plugin.app, {
					title: "提问结果",
					scope: ctx.scope,
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
		return;
	}

	if (commandId === "reading-check-selection") {
		await handleGenerateTextReadingCheck(
			plugin,
			runtime,
			ctx.editor,
			ctx.target.text,
			ctx.target.insertLine,
			ctx.scope
		);
		return;
	}

	await handleGenerateReadingSynthesis(
		plugin,
		runtime,
		ctx.editor,
		[
			{
				title: ctx.scope,
				content: ctx.target.text,
				startLine: ctx.target.insertLine,
				endLine: ctx.target.insertLine,
			},
		],
		[
			{
				sourceIndex: 0,
				title: ctx.scope,
				summary: "",
				tag: "深读",
			},
		],
		runtime.getSettings().defaultReadingNoteMode,
		ctx.scope,
		ctx.target.insertLine
	);
}
