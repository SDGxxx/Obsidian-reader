import type { AskResult } from "../../types/ask";
import type { PluginSettings } from "../../types/compress";
import systemPrompt from "../../../prompts/ask-selection.md";
import { createTextMessage } from "./client";

/**
 * 调用 Claude API 基于原文回答问题。
 *
 * - 原文为空时直接返回空 answer，不调用 API
 * - secret 为空时立即抛错，不触发 SDK 调用
 * - 不弹 Notice，所有错误通过 throw 传递给调用方
 */
export async function askText(
	text: string,
	question: string,
	settings: PluginSettings
): Promise<AskResult> {
	const normalized = text.trim();

	if (normalized.length === 0) {
		return { original: text, question, answer: "" };
	}

	const userMessage = `原文：${normalized}\n\n问题：${question}`;
	const answer = await createTextMessage(
		settings,
		systemPrompt,
		userMessage,
		"提问失败"
	);

	return { original: text, question, answer };
}
