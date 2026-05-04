import type { CompressResult, PluginSettings } from "../../types/compress";
import systemPrompt from "../../../prompts/compress-selection.md";
import { createTextMessage } from "./client";

/**
 * 调用 Claude API 压缩选中文本。
 *
 * - 空文本直接返回，不调用 API
 * - secret 为空时立即抛错，不触发 SDK 调用
 * - 根据 authMode 选择 apiKey 或 authToken 认证
 * - 不弹 Notice，所有错误通过 throw 传递给调用方
 */
export async function compressText(
	text: string,
	settings: PluginSettings
): Promise<CompressResult> {
	const normalized = text.trim();

	if (normalized.length === 0) {
		return { original: text, compressed: "", ratio: 0 };
	}

	const candidate = await createTextMessage(
		settings,
		systemPrompt,
		normalized,
		"压缩失败"
	);

	// 后校验：模型返回不短于原文时，回退为原文
	if (candidate.length >= normalized.length) {
		return { original: text, compressed: normalized, ratio: 1 };
	}

	const ratio = Math.min(
		parseFloat((candidate.length / normalized.length).toFixed(2)),
		1
	);

	return { original: text, compressed: candidate, ratio };
}
