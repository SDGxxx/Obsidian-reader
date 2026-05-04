import { vi } from "vitest";

export const Notice = vi.fn(function (this: { hide: () => void }) {
	this.hide = vi.fn();
});

function installDomHelpers() {
	if (typeof HTMLElement === "undefined") return;

	const proto = HTMLElement.prototype as HTMLElement & {
		createEl?: (
			tag: string,
			options?: { text?: string }
		) => HTMLElement;
		empty?: () => void;
	};

	if (!proto.createEl) {
		proto.createEl = function (
			this: HTMLElement,
			tag: string,
			options?: { text?: string }
		) {
			const el = document.createElement(tag);
			if (options?.text !== undefined) {
				el.textContent = options.text;
			}
			this.appendChild(el);
			return el;
		};
	}

	if (!proto.empty) {
		proto.empty = function (this: HTMLElement) {
			this.replaceChildren();
		};
	}
}

installDomHelpers();

export class MarkdownView {}

export class Plugin {}

export class PluginSettingTab {
	app: unknown;
	plugin: unknown;
	containerEl: HTMLElement;

	constructor(app: unknown, plugin: unknown) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement("div");
	}

	display() {}
}

export class Modal {
	app: unknown;
	contentEl: HTMLElement;

	constructor(app: unknown) {
		this.app = app;
		this.contentEl = document.createElement("div");
	}

	open() {
		this.onOpen();
	}

	close() {
		this.onClose();
	}

	onOpen() {}

	onClose() {}
}

class TextAreaComponent {
	inputEl: HTMLTextAreaElement;
	private changeHandler: ((value: string) => void) | null = null;

	constructor(containerEl: HTMLElement) {
		this.inputEl = document.createElement("textarea");
		containerEl.appendChild(this.inputEl);
		this.inputEl.addEventListener("input", () => {
			this.changeHandler?.(this.inputEl.value);
		});
	}

	setPlaceholder(value: string) {
		this.inputEl.placeholder = value;
		return this;
	}

	onChange(handler: (value: string) => void) {
		this.changeHandler = handler;
		return this;
	}
}

class TextComponent {
	inputEl: HTMLInputElement;
	private changeHandler: ((value: string) => void | Promise<void>) | null =
		null;

	constructor(containerEl: HTMLElement) {
		this.inputEl = document.createElement("input");
		containerEl.appendChild(this.inputEl);
		this.inputEl.addEventListener("input", () => {
			void this.changeHandler?.(this.inputEl.value);
		});
	}

	setPlaceholder(value: string) {
		this.inputEl.placeholder = value;
		return this;
	}

	setValue(value: string) {
		this.inputEl.value = value;
		return this;
	}

	onChange(handler: (value: string) => void | Promise<void>) {
		this.changeHandler = handler;
		return this;
	}
}

class DropdownComponent {
	selectEl: HTMLSelectElement;
	private changeHandler: ((value: string) => void | Promise<void>) | null =
		null;

	constructor(containerEl: HTMLElement) {
		this.selectEl = document.createElement("select");
		containerEl.appendChild(this.selectEl);
		this.selectEl.addEventListener("change", () => {
			void this.changeHandler?.(this.selectEl.value);
		});
	}

	addOption(value: string, label: string) {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = label;
		this.selectEl.appendChild(option);
		return this;
	}

	setValue(value: string) {
		this.selectEl.value = value;
		return this;
	}

	onChange(handler: (value: string) => void | Promise<void>) {
		this.changeHandler = handler;
		return this;
	}
}

class ButtonComponent {
	buttonEl: HTMLButtonElement;

	constructor(containerEl: HTMLElement) {
		this.buttonEl = document.createElement("button");
		containerEl.appendChild(this.buttonEl);
	}

	setButtonText(value: string) {
		this.buttonEl.textContent = value;
		return this;
	}

	setCta() {
		this.buttonEl.dataset.cta = "true";
		return this;
	}

	onClick(handler: () => void) {
		this.buttonEl.addEventListener("click", handler);
		return this;
	}
}

export class Setting {
	settingEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = document.createElement("div");
		containerEl.appendChild(this.settingEl);
	}

	setName(value: string) {
		const label = document.createElement("label");
		label.textContent = value;
		this.settingEl.appendChild(label);
		return this;
	}

	setDesc(value: string) {
		const desc = document.createElement("p");
		desc.textContent = value;
		this.settingEl.appendChild(desc);
		return this;
	}

	addTextArea(callback: (text: TextAreaComponent) => void) {
		callback(new TextAreaComponent(this.settingEl));
		return this;
	}

	addText(callback: (text: TextComponent) => void) {
		callback(new TextComponent(this.settingEl));
		return this;
	}

	addDropdown(callback: (dropdown: DropdownComponent) => void) {
		callback(new DropdownComponent(this.settingEl));
		return this;
	}

	addButton(callback: (button: ButtonComponent) => void) {
		callback(new ButtonComponent(this.settingEl));
		return this;
	}
}
