import { describe, expect, it, vi } from "vitest";
import { ReaderSettingTab } from "../../src/ui/settings-tab";
import type { PluginSettings } from "../../src/types/compress";

function createTab(settings: PluginSettings) {
	const plugin = {
		settings: { ...settings },
		saveSettings: vi.fn().mockResolvedValue(undefined),
	};
	const tab = new ReaderSettingTab({} as never, plugin as never);
	tab.display();
	return { tab, plugin };
}

function flush() {
	return Promise.resolve().then(() => Promise.resolve());
}

const SETTINGS: PluginSettings = {
	baseURL: "https://api.anthropic.com",
	authMode: "apiKey",
	secret: "sk-ant-test",
	rememberSecret: true,
	model: "claude-sonnet-4-6",
	defaultReadingNoteMode: "standard",
};

describe("ReaderSettingTab", () => {
	it("渲染当前设置值和默认 placeholder", () => {
		const { tab } = createTab(SETTINGS);
		const inputs = [...tab.containerEl.querySelectorAll("input")];
		const selects = [...tab.containerEl.querySelectorAll("select")];

		expect(inputs[0].value).toBe("https://api.anthropic.com");
		expect(inputs[0].placeholder).toBe("https://api.anthropic.com");
		expect(selects[0].value).toBe("apiKey");
		expect(inputs[1].type).toBe("password");
		expect(inputs[1].placeholder).toBe("sk-ant-...");
		expect(inputs[1].value).toBe("sk-ant-test");
		expect(inputs[2].placeholder).toBe("claude-sonnet-4-6");
		expect(selects[1].value).toBe("true");
		expect(selects[2].value).toBe("standard");
	});

	it("修改 Base URL / Secret / Model 会保存设置", async () => {
		const { tab, plugin } = createTab(SETTINGS);
		const inputs = [...tab.containerEl.querySelectorAll("input")];

		inputs[0].value = "https://relay.example.com";
		inputs[0].dispatchEvent(new Event("input"));
		inputs[1].value = "new-secret";
		inputs[1].dispatchEvent(new Event("input"));
		inputs[2].value = "new-model";
		inputs[2].dispatchEvent(new Event("input"));
		await flush();

		expect(plugin.settings.baseURL).toBe("https://relay.example.com");
		expect(plugin.settings.secret).toBe("new-secret");
		expect(plugin.settings.model).toBe("new-model");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(3);
	});

	it("切换 Auth Mode 会保存并重绘 Secret 提示", async () => {
		const { tab, plugin } = createTab(SETTINGS);
		const select = tab.containerEl.querySelector("select")!;

		select.value = "authToken";
		select.dispatchEvent(new Event("change"));
		await flush();

		expect(plugin.settings.authMode).toBe("authToken");
		expect(plugin.saveSettings).toHaveBeenCalledOnce();

		const inputsAfterRender = [...tab.containerEl.querySelectorAll("input")];
		expect(inputsAfterRender[1].placeholder).toBe("Bearer token...");
		expect(tab.containerEl.textContent).toContain("Auth Token");
	});

	it("切换默认读书笔记档位会保存设置", async () => {
		const { tab, plugin } = createTab(SETTINGS);
		const selects = [...tab.containerEl.querySelectorAll("select")];

		selects[2].value = "deep";
		selects[2].dispatchEvent(new Event("change"));
		await flush();

		expect(plugin.settings.defaultReadingNoteMode).toBe("deep");
		expect(plugin.saveSettings).toHaveBeenCalledOnce();
	});

	it("可切换密钥是否持久保存", async () => {
		const { tab, plugin } = createTab(SETTINGS);
		const selects = [...tab.containerEl.querySelectorAll("select")];

		selects[1].value = "false";
		selects[1].dispatchEvent(new Event("change"));
		await flush();

		expect(plugin.settings.rememberSecret).toBe(false);
		expect(plugin.saveSettings).toHaveBeenCalledOnce();
	});
});
