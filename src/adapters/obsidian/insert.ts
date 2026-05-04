import type { Editor } from "obsidian";
import { formatAsCallout } from "../../core/format";

export function makeInsertCallback(
	editor: Editor,
	insertLine: number,
	resultText: string,
	calloutTitle: string
): () => void {
	return () => {
		const callout = formatAsCallout(resultText, calloutTitle);
		appendAfterLine(editor, insertLine, callout);
	};
}

function appendAfterLine(editor: Editor, insertLine: number, text: string) {
	const lineLength = editor.getLine(insertLine).length;

	const totalLines = editor.lineCount();
	const nextLineIsEmpty =
		insertLine + 1 < totalLines && editor.getLine(insertLine + 1).trim() === "";

	const prefix = nextLineIsEmpty ? "\n" : "\n\n";
	editor.replaceRange(prefix + text, {
		line: insertLine,
		ch: lineLength,
	});
}

export function makeMarkdownInsertCallback(
	editor: Editor,
	insertLine: number,
	resultText: string
): () => void {
	return () => {
		appendAfterLine(editor, insertLine, resultText);
	};
}
