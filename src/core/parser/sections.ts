export interface RawSection {
	/** 章节标题（来自 heading 或自动编号） */
	title: string;
	/** 章节正文内容 */
	content: string;
	/** 起始行号（0-indexed） */
	startLine: number;
	/** 结束行号（0-indexed，含） */
	endLine: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;

/**
 * 获取光标所在标题下的内容范围。
 *
 * 找到光标所在或上方最近的标题，取该标题到同级/更高级标题之间的全部内容。
 * 然后对该范围内的子标题做切分。
 *
 * 返回 { title, sections, startLine, endLine } 或 null（无标题时）。
 */
export function getHeadingSectionAtCursor(
	fullText: string,
	cursorLine: number
): { title: string; startLine: number; endLine: number } | null {
	const lines = fullText.split("\n");

	if (cursorLine < 0 || cursorLine >= lines.length) return null;

	// 向上找最近的标题行
	let headingLine = -1;
	let headingLevel = 0;
	for (let i = cursorLine; i >= 0; i--) {
		const match = HEADING_RE.exec(lines[i]);
		if (match) {
			headingLine = i;
			headingLevel = match[1].length;
			break;
		}
	}

	if (headingLine === -1) return null;

	// 向下找同级或更高级标题
	let endLine = lines.length - 1;
	for (let i = headingLine + 1; i < lines.length; i++) {
		const match = HEADING_RE.exec(lines[i]);
		if (match && match[1].length <= headingLevel) {
			endLine = i - 1;
			break;
		}
	}

	const titleMatch = HEADING_RE.exec(lines[headingLine]);
	const title = titleMatch ? titleMatch[2] : lines[headingLine];

	return { title, startLine: headingLine, endLine };
}

/**
 * 对指定行范围内的文本做子章节切分。
 * 复用 splitIntoSections 的逻辑。
 */
export function splitRangeIntoSections(
	fullText: string,
	startLine: number,
	endLine: number
): RawSection[] {
	const lines = fullText.split("\n");
	const rangeLines = lines.slice(startLine, endLine + 1);
	const rangeText = rangeLines.join("\n");

	const sections = splitIntoSections(rangeText);

	// 修正行号偏移
	return sections.map((s) => ({
		...s,
		startLine: s.startLine + startLine,
		endLine: s.endLine + startLine,
	}));
}

/**
 * 将 Markdown 全文切分为章节。
 *
 * 优先按标题（# ~ ######）切分。
 * 如果整篇文档没有标题，则按空行做粗粒度分段。
 *
 * 纯函数，不依赖 Obsidian API。
 */
export function splitIntoSections(fullText: string): RawSection[] {
	const lines = fullText.split("\n");

	// 尝试按标题切分
	const headingIndices: number[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (HEADING_RE.test(lines[i])) {
			headingIndices.push(i);
		}
	}

	if (headingIndices.length > 0) {
		return splitByHeadings(lines, headingIndices);
	}

	// 无标题，按空行分段
	return splitByBlankLines(lines);
}

function splitByHeadings(lines: string[], headingIndices: number[]): RawSection[] {
	const sections: RawSection[] = [];

	// 标题前如果有内容，作为"引言"段
	if (headingIndices[0] > 0) {
		const content = lines.slice(0, headingIndices[0]).join("\n").trim();
		if (content) {
			sections.push({
				title: "引言",
				content,
				startLine: 0,
				endLine: headingIndices[0] - 1,
			});
		}
	}

	for (let i = 0; i < headingIndices.length; i++) {
		const startLine = headingIndices[i];
		const endLine =
			i + 1 < headingIndices.length
				? headingIndices[i + 1] - 1
				: lines.length - 1;

		const match = HEADING_RE.exec(lines[startLine]);
		const title = match ? match[2] : lines[startLine];
		const contentLines = lines.slice(startLine + 1, endLine + 1);
		const content = contentLines.join("\n").trim();

		sections.push({ title, content, startLine, endLine });
	}

	return sections;
}

function splitByBlankLines(lines: string[]): RawSection[] {
	const sections: RawSection[] = [];
	let start = -1;

	for (let i = 0; i <= lines.length; i++) {
		const isEmpty = i === lines.length || lines[i].trim() === "";

		if (!isEmpty && start === -1) {
			start = i;
		} else if (isEmpty && start !== -1) {
			const content = lines.slice(start, i).join("\n").trim();
			if (content) {
				sections.push({
					title: `段落 ${sections.length + 1}`,
					content,
					startLine: start,
					endLine: i - 1,
				});
			}
			start = -1;
		}
	}

	return sections;
}
