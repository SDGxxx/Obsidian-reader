import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginSettings } from "../../../src/types/compress";

const mockCreate = vi.fn();
let capturedOptions: Record<string, unknown> = {};
let capturedRequest: Record<string, unknown> = {};

vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = {
			create: (request: Record<string, unknown>) => {
				capturedRequest = request;
				return mockCreate(request);
			},
		};

		constructor(options: Record<string, unknown>) {
			capturedOptions = options;
		}
	},
}));

import { createTextMessage } from "../../../src/core/ai/client";

const API_KEY_SETTINGS: PluginSettings = {
	baseURL: "https://api.anthropic.com",
	authMode: "apiKey",
	secret: "sk-ant-test-key",
	model: "claude-sonnet-4-6",
};

beforeEach(() => {
	mockCreate.mockReset();
	capturedOptions = {};
	capturedRequest = {};
});

describe("createTextMessage", () => {
	it("apiKey 模式传入 apiKey、baseURL 和请求参数", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "结果" }],
		});

		const result = await createTextMessage(
			API_KEY_SETTINGS,
			"system prompt",
			"user text",
			"测试失败"
		);

		expect(result).toBe("结果");
		expect(capturedOptions.apiKey).toBe("sk-ant-test-key");
		expect(capturedOptions.baseURL).toBe("https://api.anthropic.com");
		expect(capturedOptions).not.toHaveProperty("authToken");
		expect(capturedRequest.model).toBe("claude-sonnet-4-6");
		expect(capturedRequest.max_tokens).toBe(4096);
		expect(capturedRequest.system).toBe("system prompt");
		expect(capturedRequest.messages).toEqual([
			{ role: "user", content: "user text" },
		]);
	});

	it("允许调用方覆盖 max_tokens", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "结果" }],
		});

		await createTextMessage(
			API_KEY_SETTINGS,
			"system",
			"user",
			"测试失败",
			8192
		);

		expect(capturedRequest.max_tokens).toBe(8192);
	});

	it("authToken 模式传入 authToken，不传 apiKey", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "结果" }],
		});

		await createTextMessage(
			{
				...API_KEY_SETTINGS,
				baseURL: "https://relay.example.com",
				authMode: "authToken",
				secret: "my-token",
			},
			"system",
			"user",
			"测试失败"
		);

		expect(capturedOptions.authToken).toBe("my-token");
		expect(capturedOptions.baseURL).toBe("https://relay.example.com");
		expect(capturedOptions).not.toHaveProperty("apiKey");
	});

	it("空模型和空 baseURL 使用默认配置", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "结果" }],
		});

		await createTextMessage(
			{ ...API_KEY_SETTINGS, model: "", baseURL: "" },
			"system",
			"user",
			"测试失败"
		);

		expect(capturedOptions.baseURL).toBe("https://api.anthropic.com");
		expect(capturedRequest.model).toBe("claude-sonnet-4-6");
	});

	it("secret 为空时不调用 SDK", async () => {
		await expect(
			createTextMessage(
				{ ...API_KEY_SETTINGS, secret: "" },
				"system",
				"user",
				"测试失败"
			)
		).rejects.toThrow("请先在设置中配置密钥");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("返回无有效 text block 时抛出带前缀的错误", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
		});

		await expect(
			createTextMessage(API_KEY_SETTINGS, "system", "user", "测试失败")
		).rejects.toThrow("测试失败：未获得有效结果");
	});
});
