import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginSettings } from "../../../src/types/compress";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: mockCreate };
		constructor() {}
	},
}));

vi.mock("../../../prompts/ask-selection.md", () => ({
	default: "你是一个阅读辅助工具。",
}));

import { askText } from "../../../src/core/ai/ask";

const VALID_SETTINGS: PluginSettings = {
	baseURL: "https://api.anthropic.com",
	authMode: "apiKey",
	secret: "sk-ant-test-key",
	model: "claude-sonnet-4-6",
};

beforeEach(() => {
	mockCreate.mockReset();
});

describe("askText", () => {
	it("正常返回：构造正确的 AskResult", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "这是回答" }],
		});

		const result = await askText("原文内容", "这段在说什么？", VALID_SETTINGS);

		expect(result.original).toBe("原文内容");
		expect(result.question).toBe("这段在说什么？");
		expect(result.answer).toBe("这是回答");
	});

	it("secret 为空时直接抛错，SDK 不被调用", async () => {
		const settings: PluginSettings = { ...VALID_SETTINGS, secret: "" };

		await expect(
			askText("一些文本", "问题", settings)
		).rejects.toThrow("请先在设置中配置密钥");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("SDK 抛异常：错误向上传递", async () => {
		mockCreate.mockRejectedValue(new Error("network error"));

		await expect(
			askText("一些文本", "问题", VALID_SETTINGS)
		).rejects.toThrow("network error");
	});

	it("空白输入文本直接返回，不调用 SDK", async () => {
		const result = await askText("   \t\n  ", "问题", VALID_SETTINGS);

		expect(result.original).toBe("   \t\n  ");
		expect(result.question).toBe("问题");
		expect(result.answer).toBe("");
		expect(mockCreate).not.toHaveBeenCalled();
	});
});
