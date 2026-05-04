import { App, Editor, MarkdownView, Notice } from "obsidian";
import { MAX_TEXT_LENGTH, isCodeBlock } from "../../core/format";
import { getParagraphAtCursor } from "../../core/parser/paragraph";

export interface TextTarget {
	text: string;
	insertLine: number;
}

export interface TextCommandContext {
	editor: Editor;
	target: TextTarget;
	scope: string;
}

/**
 * 段落级命令的 Obsidian 适配：定位编辑器、选区/段落和前置校验。
 */
export function prepareTextCommand(
	app: App,
	isProcessing: boolean
): TextCommandContext | null {
	if (isProcessing) {
		new Notice("正在处理中，请稍候");
		return null;
	}

	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) {
		new Notice("未找到可用编辑器");
		return null;
	}

	const editor = view.editor;
	const selection = editor.getSelection();
	let target: TextTarget;
	let scope: string;

	if (selection) {
		target = {
			text: selection,
			insertLine: editor.getCursor("to").line,
		};
		scope = "选中文本";
	} else {
		const fullText = editor.getValue();
		const cursorLine = editor.getCursor().line;
		const paragraph = getParagraphAtCursor(fullText, cursorLine);
		if (!paragraph) {
			new Notice("当前段落为空，请选中文本或将光标移到段落内");
			return null;
		}
		target = {
			text: paragraph.text,
			insertLine: paragraph.endLine,
		};
		scope = "当前段落";
	}

	if (isCodeBlock(target.text)) {
		new Notice("暂不支持处理代码块");
		return null;
	}

	if (target.text.length > MAX_TEXT_LENGTH) {
		new Notice(
			`文本过长（${target.text.length} 字），请控制在 ${MAX_TEXT_LENGTH} 字以内`
		);
		return null;
	}

	return { editor, target, scope };
}
