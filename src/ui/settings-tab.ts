import { App, PluginSettingTab, Setting } from "obsidian";
import type ObsidianReaderPlugin from "../main";
import { DEFAULT_SETTINGS } from "../types/compress";
import { READING_NOTE_MODE_LABELS, type ReadingNoteMode } from "../types/note";

export class ReaderSettingTab extends PluginSettingTab {
	plugin: ObsidianReaderPlugin;

	constructor(app: App, plugin: ObsidianReaderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Base URL")
			.setDesc(
				`API 端点地址，留空使用默认值 ${DEFAULT_SETTINGS.baseURL}`
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.baseURL)
					.setValue(this.plugin.settings.baseURL)
					.onChange(async (value) => {
						this.plugin.settings.baseURL = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auth Mode")
			.setDesc("认证方式：API Key（官方）或 Auth Token（中转站）")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("apiKey", "API Key")
					.addOption("authToken", "Auth Token")
					.setValue(this.plugin.settings.authMode)
					.onChange(async (value) => {
						this.plugin.settings.authMode = value as
							| "apiKey"
							| "authToken";
						await this.plugin.saveSettings();
						this.display();
					})
			);

		const isToken = this.plugin.settings.authMode === "authToken";
		new Setting(containerEl)
			.setName("Secret")
			.setDesc(isToken ? "Auth Token" : "Anthropic API Key")
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder(isToken ? "Bearer token..." : "sk-ant-...")
					.setValue(this.plugin.settings.secret)
					.onChange(async (value) => {
						this.plugin.settings.secret = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Remember Secret")
			.setDesc(
				"关闭后密钥只保存在当前 Obsidian 会话内，重启后需要重新输入"
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("true", "保存到 data.json")
					.addOption("false", "仅本次会话")
					.setValue(String(this.plugin.settings.rememberSecret))
					.onChange(async (value) => {
						this.plugin.settings.rememberSecret = value !== "false";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Model")
			.setDesc(`模型名称，留空使用默认值 ${DEFAULT_SETTINGS.model}`)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.model)
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default Reading Note Mode")
			.setDesc("结构地图中生成读书笔记时的默认档位")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("light", READING_NOTE_MODE_LABELS.light)
					.addOption("standard", READING_NOTE_MODE_LABELS.standard)
					.addOption("deep", READING_NOTE_MODE_LABELS.deep)
					.setValue(this.plugin.settings.defaultReadingNoteMode)
					.onChange(async (value) => {
						this.plugin.settings.defaultReadingNoteMode =
							toReadingNoteMode(value);
						await this.plugin.saveSettings();
					})
			);
	}
}

function toReadingNoteMode(value: string): ReadingNoteMode {
	if (value === "light" || value === "deep") return value;
	return "standard";
}
