import { Plugin } from "obsidian";
import {
	registerTextActionCommands,
	runTextActionCommand,
} from "./commands/text-actions";
import {
	registerStructureMapCommands,
	runStructureMapCommand,
} from "./commands/structure-map";
import type { CommandRuntime } from "./commands/runtime";
import type { PluginSettings } from "./types/compress";
import { DEFAULT_SETTINGS } from "./types/compress";
import type { LastStructureMapSession } from "./types/structure";
import { ReaderHubModal } from "./ui/reader-hub-modal";
import { ReaderSettingTab } from "./ui/settings-tab";

export default class ObsidianReaderPlugin extends Plugin {
	settings!: PluginSettings;
	private isProcessing = false;
	private lastStructureMapSession: LastStructureMapSession | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ReaderSettingTab(this.app, this));

		const runtime: CommandRuntime = {
			getSettings: () => this.settings,
			isProcessing: () => this.isProcessing,
			setProcessing: (value) => {
				this.isProcessing = value;
			},
			getLastStructureMapSession: () => this.lastStructureMapSession,
			setLastStructureMapSession: (session) => {
				this.lastStructureMapSession = session;
			},
		};

		registerTextActionCommands(this, runtime);
		registerStructureMapCommands(this, runtime);
		this.addReaderRibbonIcon(runtime);
	}

	onunload() {
		// 当前没有需要额外清理的长生命周期资源。
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		const dataToSave = {
			...this.settings,
			secret: this.settings.rememberSecret ? this.settings.secret : "",
		};
		await this.saveData(dataToSave);
	}

	private addReaderRibbonIcon(runtime: CommandRuntime) {
		const ribbonIconEl = this.addRibbonIcon("book-open", "Obsidian Reader", () => {
			this.openReaderHub(runtime);
		});

		window.setTimeout(() => {
			ribbonIconEl.parentElement?.appendChild(ribbonIconEl);
		}, 0);
	}

	private openReaderHub(runtime: CommandRuntime) {
		const lastStructureMapSession = runtime.getLastStructureMapSession?.() || null;

		new ReaderHubModal(this.app, {
			groups: [
				{
					title: "当前文本",
					actions: [
						{
							label: "压缩",
							onClick: () =>
								runTextActionCommand(this, runtime, "compress-selection"),
						},
						{
							label: "展开",
							onClick: () =>
								runTextActionCommand(this, runtime, "expand-selection"),
						},
						{
							label: "提问",
							onClick: () =>
								runTextActionCommand(this, runtime, "ask-selection"),
						},
						{
							label: "理解检查",
							onClick: () =>
								runTextActionCommand(
									this,
									runtime,
									"reading-check-selection"
								),
						},
						{
							label: "读后沉淀",
							primary: true,
							onClick: () =>
								runTextActionCommand(
									this,
									runtime,
									"reading-synthesis-selection"
								),
						},
					],
				},
				{
					title: "结构地图",
					actions: [
						...(lastStructureMapSession
							? [
									{
										label: `恢复：${lastStructureMapSession.scope}`,
										primary: true,
										onClick: () => lastStructureMapSession.reopen(),
									},
							  ]
							: []),
						{
							label: "当前标题",
							onClick: () =>
								runStructureMapCommand(
									this,
									runtime,
									"structure-map-heading"
								),
						},
						{
							label: "整篇文档",
							onClick: () =>
								runStructureMapCommand(
									this,
									runtime,
									"structure-map-document"
								),
						},
					],
				},
			],
		}).open();
	}
}
