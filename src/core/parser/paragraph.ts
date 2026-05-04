export interface ParagraphRange {
	/** 段落文本 */
	text: string;
	/** 起始行号（0-indexed） */
	startLine: number;
	/** 结束行号（0-indexed，含） */
	endLine: number;
}

/**
 * 获取光标所在段落。
 *
 * 规则：按空行分段。
 * - 光标所在行是空行 → 返回 null
 * - 从光标行向上找到空行或文档开头 → startLine
 * - 从光标行向下找到空行或文档结尾 → endLine
 * - 取 startLine ~ endLine 的行 join("\n")
 *
 * 纯函数，不依赖 Obsidian API。
 */
export function getParagraphAtCursor(
	fullText: string,
	cursorLine: number
): ParagraphRange | null {
	const lines = fullText.split("\n");

	// 越界保护
	if (cursorLine < 0 || cursorLine >= lines.length) {
		return null;
	}

	// 光标在空行上
	if (lines[cursorLine].trim() === "") {
		return null;
	}

	// 向上找段落起始
	let startLine = cursorLine;
	while (startLine > 0 && lines[startLine - 1].trim() !== "") {
		startLine--;
	}

	// 向下找段落结束
	let endLine = cursorLine;
	while (endLine < lines.length - 1 && lines[endLine + 1].trim() !== "") {
		endLine++;
	}

	const text = lines.slice(startLine, endLine + 1).join("\n");

	return { text, startLine, endLine };
}
