/**
 * 将文本格式化为 Obsidian callout。
 *
 * 纯函数，每行前加 "> " 前缀，首行加 callout 头。
 */
export function formatAsCallout(
	text: string,
	title: string = "压缩结果"
): string {
	const lines = text.split("\n").map((line) => `> ${line}`);
	return `> [!summary] ${title}\n${lines.join("\n")}`;
}

/** 文本字符数上限 */
export const MAX_TEXT_LENGTH = 5000;

/**
 * 检测文本是否主要是代码块。
 *
 * 规则：trim 后以 ``` 开头且以 ``` 结尾，
 * 或者超过一半的行以常见代码缩进/语法标记开头。
 */
export function isCodeBlock(text: string): boolean {
	const trimmed = text.trim();

	// 整段被 ``` 包裹
	if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
		return true;
	}

	// 超过一半的行像代码（以 tab / 4空格 / import / export / function / const / let / var / // / # 开头）
	const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
	if (lines.length === 0) return false;

	const codePattern =
		/^(\t|    |import |export |function |const |let |var |\/\/|#include|class |if \(|for \(|while \(|return )/;
	const codeLinesCount = lines.filter((l) => codePattern.test(l)).length;

	return codeLinesCount / lines.length > 0.5;
}
