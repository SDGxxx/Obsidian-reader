import { App, Modal } from "obsidian";

/**
 * 输入问题的 Modal。
 * 用户输入问题后点击"提问"按钮，通过 onSubmit 回调返回问题文本。
 */
export class AskInputModal extends Modal {
	private onSubmit: (question: string) => void;
	private question = "";

	constructor(app: App, onSubmit: (question: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		this.configureModalShell();
		contentEl.empty();
		contentEl.classList.add("obsidian-reader-panel-content");

		const root = contentEl.createEl("div");
		root.classList.add("obsidian-reader-panel");

		const header = root.createEl("div");
		header.classList.add("obsidian-reader-panel-header");
		header.createEl("div", { text: "Obsidian Reader" }).classList.add(
			"obsidian-reader-eyebrow"
		);
		header.createEl("h3", { text: "提问" });

		const body = root.createEl("div");
		body.classList.add("obsidian-reader-panel-body");

		const field = body.createEl("label");
		field.classList.add("obsidian-reader-field");
		field.createEl("span", { text: "你的问题" });
		const textarea = field.createEl("textarea");
		textarea.placeholder = "输入你想问的问题...";
		textarea.rows = 4;
		textarea.addEventListener("input", () => {
			this.question = textarea.value;
		});

		const errorEl = contentEl.createEl("p", {
			text: "请输入问题",
		});
		errorEl.classList.add("obsidian-reader-error");
		errorEl.style.display = "none";
		body.appendChild(errorEl);

		const footer = root.createEl("div");
		footer.classList.add("obsidian-reader-panel-footer");
		const submitBtn = footer.createEl("button", { text: "提问" });
		submitBtn.classList.add("mod-cta");
		submitBtn.addEventListener("click", () => {
			const q = this.question.trim();
			if (!q) {
				errorEl.style.display = "block";
				return;
			}
			this.close();
			this.onSubmit(q);
		});
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
