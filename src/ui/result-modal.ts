import { App, Modal } from "obsidian";

export interface ResultSection {
	label: string;
	text: string;
}

export interface ResultModalOptions {
	/** Modal 标题 */
	title: string;
	/** 作用范围标签（如"选中文本" / "当前段落"） */
	scope?: string;
	/** 内容区块列表 */
	sections: ResultSection[];
	/** "复制结果"按钮复制的文本 */
	copyText: string;
	/** 写入正文回调 */
	onInsert?: () => void;
	/** 写入为 Markdown 标题块 */
	onInsertMarkdown?: () => void;
}

/**
 * 统一结果展示 Modal。
 * 压缩/展开/提问共用同一布局。
 */
export class ResultModal extends Modal {
	private opts: ResultModalOptions;

	constructor(app: App, opts: ResultModalOptions) {
		super(app);
		this.opts = opts;
	}

	onOpen() {
		const { contentEl } = this;
		const {
			title,
			scope,
			sections,
			copyText,
			onInsert,
			onInsertMarkdown,
		} = this.opts;

		this.configureModalShell();
		contentEl.empty();
		contentEl.classList.add("obsidian-reader-panel-content");

		const headerText = scope ? `${title} — ${scope}` : title;
		const root = contentEl.createEl("div");
		root.classList.add("obsidian-reader-panel");

		const header = root.createEl("div");
		header.classList.add("obsidian-reader-panel-header");
		header.createEl("div", { text: "Obsidian Reader" }).classList.add(
			"obsidian-reader-eyebrow"
		);
		header.createEl("h3", { text: headerText });

		const body = root.createEl("div");
		body.classList.add("obsidian-reader-panel-body");

		for (const section of sections) {
			const sectionEl = body.createEl("section");
			sectionEl.classList.add("obsidian-reader-result-section");
			sectionEl.createEl("h4", { text: section.label });
			const el = sectionEl.createEl("p", { text: section.text });
			el.classList.add("obsidian-reader-prewrap");
		}

		const btnContainer = root.createEl("div");
		btnContainer.classList.add("obsidian-reader-panel-footer");

		const copyBtn = btnContainer.createEl("button", {
			text: "复制结果",
		});
		copyBtn.addEventListener("click", async () => {
			await navigator.clipboard.writeText(copyText);
			copyBtn.textContent = "已复制";
			setTimeout(() => {
				copyBtn.textContent = "复制结果";
			}, 1000);
		});

		if (onInsert) {
			const insertCallback = onInsert;
			const insertBtn = btnContainer.createEl("button", {
				text: "写入正文",
			});
			insertBtn.classList.add("mod-cta");
			insertBtn.addEventListener("click", () => {
				insertCallback();
				insertBtn.textContent = "已写入";
				insertBtn.disabled = true;
			});
		}

		if (onInsertMarkdown) {
			const insertMarkdownCallback = onInsertMarkdown;
			const insertMarkdownBtn = btnContainer.createEl("button", {
				text: "写入为标题块",
			});
			insertMarkdownBtn.classList.add("mod-cta");
			insertMarkdownBtn.addEventListener("click", () => {
				insertMarkdownCallback();
				insertMarkdownBtn.textContent = "已写入";
				insertMarkdownBtn.disabled = true;
			});
		}
	}

	onClose() {
		this.contentEl.empty();
	}

	private configureModalShell() {
		(this as unknown as { modalEl?: HTMLElement }).modalEl?.classList.add(
			"obsidian-reader-standard-modal"
		);
		this.titleEl?.classList.add("obsidian-reader-hidden-title");
	}
}
