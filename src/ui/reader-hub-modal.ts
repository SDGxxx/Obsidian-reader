import { App, Modal } from "obsidian";

interface ReaderAction {
	label: string;
	primary?: boolean;
	onClick: () => void | Promise<void>;
}

interface ReaderActionGroup {
	title: string;
	actions: ReaderAction[];
}

export interface ReaderHubModalOptions {
	groups: ReaderActionGroup[];
}

export class ReaderHubModal extends Modal {
	constructor(
		app: App,
		private readonly opts: ReaderHubModalOptions
	) {
		super(app);
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
		header.createEl("div", { text: "入口" }).classList.add(
			"obsidian-reader-eyebrow"
		);
		header.createEl("h3", { text: "Obsidian Reader" });

		const body = root.createEl("div");
		body.classList.add("obsidian-reader-panel-body");

		for (const group of this.opts.groups) {
			const groupEl = body.createEl("section");
			groupEl.classList.add("obsidian-reader-action-group");
			groupEl.createEl("h4", { text: group.title });
			const actionRow = groupEl.createEl("div");
			actionRow.classList.add("obsidian-reader-action-grid");

			for (const action of group.actions) {
				const button = actionRow.createEl("button", { text: action.label });
				if (action.primary) {
					button.classList.add("mod-cta");
				}
				button.addEventListener("click", async () => {
					this.close();
					await action.onClick();
				});
			}
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
