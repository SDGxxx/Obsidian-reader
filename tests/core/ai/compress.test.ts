import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginSettings } from "../../../src/types/compress";

// 捕获 Anthropic 构造参数 + mock messages.create
const mockCreate = vi.fn();
let capturedOptions: Record<string, unknown> = {};

vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = { create: mockCreate };
		constructor(options: Record<string, unknown>) {
			capturedOptions = options;
		}
	},
}));

vi.mock("../../../prompts/compress-selection.md", () => ({
	default: "你是一个阅读辅助工具。",
}));

import { compressText } from "../../../src/core/ai/compress";

const API_KEY_SETTINGS: PluginSettings = {
	baseURL: "https://api.anthropic.com",
	authMode: "apiKey",
	secret: "sk-ant-test-key",
	model: "claude-sonnet-4-6",
};

beforeEach(() => {
	mockCreate.mockReset();
	capturedOptions = {};
});

describe("compressText", () => {
	it("正常返回文本块：构造正确的 CompressResult", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "压缩后的内容" }],
		});

		const result = await compressText("这是一段需要被压缩的较长文本内容", API_KEY_SETTINGS);

		expect(result.original).toBe("这是一段需要被压缩的较长文本内容");
		expect(result.compressed).toBe("压缩后的内容");
		expect(result.ratio).toBeGreaterThan(0);
		expect(result.ratio).toBeLessThanOrEqual(1);
		expect(result.ratio.toString()).toMatch(/^\d+\.?\d{0,2}$/);
	});

	it("secret 为空时直接抛错", async () => {
		const settings: PluginSettings = {
			...API_KEY_SETTINGS,
			secret: "",
		};

		await expect(compressText("一些文本", settings)).rejects.toThrow(
			"请先在设置中配置密钥"
		);
	});

	it("secret 为空时 SDK 不被调用", async () => {
		const settings: PluginSettings = {
			...API_KEY_SETTINGS,
			secret: "",
		};

		try {
			await compressText("一些文本", settings);
		} catch {
			// 预期抛错
		}

		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("SDK 抛异常：错误向上传递", async () => {
		mockCreate.mockRejectedValue(new Error("network error"));

		await expect(
			compressText("一些文本", API_KEY_SETTINGS)
		).rejects.toThrow("network error");
	});

	it("返回无有效 text block：抛出明确错误", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
		});

		await expect(
			compressText("一些文本", API_KEY_SETTINGS)
		).rejects.toThrow("压缩失败：未获得有效结果");
	});

	it("空白输入直接返回，不调用 SDK", async () => {
		const result = await compressText("   \t\n  ", API_KEY_SETTINGS);

		expect(result.original).toBe("   \t\n  ");
		expect(result.compressed).toBe("");
		expect(result.ratio).toBe(0);
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("apiKey 模式：传 apiKey + baseURL，不传 authToken", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "结果" }],
		});

		await compressText("一些文本", API_KEY_SETTINGS);

		expect(capturedOptions.apiKey).toBe("sk-ant-test-key");
		expect(capturedOptions.baseURL).toBe("https://api.anthropic.com");
		expect(capturedOptions).not.toHaveProperty("authToken");
	});

	it("authToken 模式：传 authToken + baseURL，不传 apiKey", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "结果" }],
		});

		const tokenSettings: PluginSettings = {
			baseURL: "https://relay.example.com",
			authMode: "authToken",
			secret: "my-bearer-token",
			model: "claude-sonnet-4-6",
		};

		await compressText("一些文本", tokenSettings);

		expect(capturedOptions.authToken).toBe("my-bearer-token");
		expect(capturedOptions.baseURL).toBe("https://relay.example.com");
		expect(capturedOptions).not.toHaveProperty("apiKey");
	});

	it("模型返回比原文更长时，回退为原文，ratio = 1", async () => {
		const input = "短文本";
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: "这是一段比原文长得多的扩写内容" }],
		});

		const result = await compressText(input, API_KEY_SETTINGS);

		expect(result.original).toBe(input);
		expect(result.compressed).toBe(input);
		expect(result.ratio).toBe(1);
	});
});
