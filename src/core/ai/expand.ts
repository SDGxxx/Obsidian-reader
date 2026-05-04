import type { ExpandResult } from "../../types/expand";
import type { PluginSettings } from "../../types/compress";
import systemPrompt from "../../../prompts/expand-selection.md";
import { createTextMessage } from "./client";

/**
 * 调用 Claude API 展开选中文本。
 *
 * - 空文本直接返回，不调用 API
 * - secret 为空时立即抛错，不触发 SDK 调用
 * - 不弹 Notice，所有错误通过 throw 传递给调用方
 */
export async function expandText(
	text: string,
	settings: PluginSettings
): Promise<ExpandResult> {
	const normalized = text.trim();

	if (normalized.length === 0) {
		return { original: text, expanded: "" };
	}

	const expanded = await createTextMessage(
		settings,
		systemPrompt,
		normalized,
		"展开失败"
	);

	return { original: text, expanded };
}
