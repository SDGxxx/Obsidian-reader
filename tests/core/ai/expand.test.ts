import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginSettings } from "../../../src/types/compress";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: mockCreate };
		constructor() {}
	},
}));

vi.mock("../../../prompts/expand-selection.md", () => ({
	default: "你是一个阅读辅助工具。",
}));

import { expandText } from "../../../src/core/ai/expand";

const VALID_SETTINGS: PluginSettings = {
	baseURL: "https://api.anthropic.com",
	authMode: "apiKey",
	secret: "sk-ant-test-key",
	model: "claude-sonnet-4-6",
};

beforeEach(() => {
	mockCreate.mockReset();
});

describe("expandText", () => {
	it("正常返回：构造正确的 ExpandResult", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "展开后的详细内容" }],
		});

		const result = await expandText("简短观点", VALID_SETTINGS);

		expect(result.original).toBe("简短观点");
		expect(result.expanded).toBe("展开后的详细内容");
	});

	it("secret 为空时直接抛错，SDK 不被调用", async () => {
		const settings: PluginSettings = { ...VALID_SETTINGS, secret: "" };

		await expect(expandText("一些文本", settings)).rejects.toThrow(
			"请先在设置中配置密钥"
		);
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("SDK 抛异常：错误向上传递", async () => {
		mockCreate.mockRejectedValue(new Error("network error"));

		await expect(
			expandText("一些文本", VALID_SETTINGS)
		).rejects.toThrow("network error");
	});

	it("空白输入直接返回，不调用 SDK", async () => {
		const result = await expandText("   \t\n  ", VALID_SETTINGS);

		expect(result.original).toBe("   \t\n  ");
		expect(result.expanded).toBe("");
		expect(mockCreate).not.toHaveBeenCalled();
	});
});
