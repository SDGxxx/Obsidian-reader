import Anthropic from "@anthropic-ai/sdk";
import type { PluginSettings } from "../../types/compress";
import { DEFAULT_SETTINGS } from "../../types/compress";

export function createAnthropicClient(settings: PluginSettings): Anthropic {
	if (!settings.secret) {
		throw new Error("请先在设置中配置密钥");
	}

	const baseURL = settings.baseURL.trim() || DEFAULT_SETTINGS.baseURL;
	const clientOptions: ConstructorParameters<typeof Anthropic>[0] = {
		baseURL,
		dangerouslyAllowBrowser: true,
	};

	if (settings.authMode === "authToken") {
		clientOptions.authToken = settings.secret;
	} else {
		clientOptions.apiKey = settings.secret;
	}

	return new Anthropic(clientOptions);
}

export async function createTextMessage(
	settings: PluginSettings,
	systemPrompt: string,
	userContent: string,
	errorPrefix: string,
	maxTokens = 4096
): Promise<string> {
	const model = settings.model || DEFAULT_SETTINGS.model;
	const client = createAnthropicClient(settings);

	const response = await client.messages.create({
		model,
		max_tokens: maxTokens,
		system: systemPrompt,
		messages: [{ role: "user", content: userContent }],
	});

	const textBlock = response.content.find(
		(block): block is Anthropic.TextBlock => block.type === "text"
	);
	if (!textBlock || !textBlock.text.trim()) {
		throw new Error(`${errorPrefix}：未获得有效结果`);
	}

	return textBlock.text.trim();
}
