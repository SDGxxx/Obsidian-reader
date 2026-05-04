import { App, Modal } from "obsidian";
import {
	READING_NOTE_MODE_LABELS,
	type ReadingNoteMode,
} from "../types/note";
import type {
	SectionAnalysis,
	StructureMapResult,
	StructureMapViewState,
} from "../types/structure";
import { MAX_READING_NOTE_INPUT_LENGTH } from "../core/note-generation/limits";

export type SectionAction = "compress" | "expand" | "ask" | "check";

export interface StructureMapModalOptions {
	/** 作用范围标签，显示在 Modal 标题时使用。 */
	scope: string;
	result: StructureMapResult;
	defaultReadingNoteMode?: ReadingNoteMode;
	initialViewState?: StructureMapViewState;
	sectionContentLengths?: Record<number, number>;
	onPersistViewState?: (state: StructureMapViewState) => void;
	onInsert?: (sections: SectionAnalysis[]) => void;
	onSectionAction?: (sectionIndex: number, action: SectionAction) => void;
	onGenerateReadingNote?: (
		sections: SectionAnalysis[],
		mode: ReadingNoteMode
	) => void | Promise<void>;
	onGenerateReadingCheck?: (
		sections: SectionAnalysis[],
		mode: ReadingNoteMode
	) => void | Promise<void>;
	onGenerateReadingSynthesis?: (
		sections: SectionAnalysis[],
		mode: ReadingNoteMode
	) => void | Promise<void>;
}

/**
 * 结构地图是阅读控制台：它保留章节选择、分层展示和后续沉淀入口。
 */
export class StructureMapModal extends Modal {
	private opts: StructureMapModalOptions;
	private selectedSourceIndexes = new Set<number>();
	private currentTagBySourceIndex = new Map<number, SectionAnalysis["tag"]>();
	private readingNoteMode: ReadingNoteMode = "standard";
	private cleanupHandlers: Array<() => void> = [];

	constructor(app: App, opts: StructureMapModalOptions) {
		super(app);
		this.opts = opts;
		this.readingNoteMode =
			opts.initialViewState?.readingNoteMode ??
			opts.defaultReadingNoteMode ??
			"standard";
	}

	onOpen() {
		const { contentEl } = this;
		const {
			result,
			onInsert,
			onSectionAction,
			onGenerateReadingNote,
			onGenerateReadingCheck,
			onGenerateReadingSynthesis,
			scope,
		} = this.opts;
		const { sections, highlights } = result;
		const hasSectionSelection =
			!!onGenerateReadingNote ||
			!!onGenerateReadingCheck ||
			!!onGenerateReadingSynthesis;
		const generationActionLabel = getGenerationActionLabel(
			!!onGenerateReadingNote,
			!!onGenerateReadingCheck,
			!!onGenerateReadingSynthesis
		);
		const sectionOrderBySourceIndex = new Map(
			sections.map((section, index) => [section.sourceIndex, index])
		);

		this.configureModalShell();
		this.currentTagBySourceIndex = this.buildInitialTagMap(sections);
		this.selectedSourceIndexes = this.buildInitialSelection(sections);

		contentEl.empty();
		contentEl.classList.add("obsidian-reader-structure-content");

		const root = contentEl.createEl("div");
		root.classList.add("obsidian-reader-structure-root");

		const header = root.createEl("div");
		header.classList.add("obsidian-reader-structure-header");

		const titleBlock = header.createEl("div");
		titleBlock.classList.add("obsidian-reader-structure-title-block");
		titleBlock.createEl("div", {
			text: "结构地图",
		}).classList.add("obsidian-reader-eyebrow");
		titleBlock.createEl("h3", { text: scope });

		const headerActions = header.createEl("div");
		headerActions.classList.add("obsidian-reader-header-actions");

		const maximizeBtn = headerActions.createEl("button", { text: "放大" });
		maximizeBtn.classList.add("obsidian-reader-ghost-button");
		maximizeBtn.addEventListener("click", () => {
			const modalEl = this.getModalEl();
			if (!modalEl) return;
			const maximized = modalEl.classList.toggle(
				"obsidian-reader-modal-maximized"
			);
			maximizeBtn.textContent = maximized ? "恢复" : "放大";
		});

		const stashBtn = headerActions.createEl("button", { text: "暂存关闭" });
		stashBtn.classList.add("obsidian-reader-ghost-button");
		stashBtn.addEventListener("click", () => {
			this.persistViewState();
			this.close();
		});

		this.enableDrag(header);

		const stats = header.createEl("div");
		stats.classList.add("obsidian-reader-stats");
		const strategySummaryEl = stats.createEl("span");
		const selectionSummaryEl = stats.createEl("span");
		const noteStatusEl = stats.createEl("span");

		const body = root.createEl("div");
		body.classList.add("obsidian-reader-structure-body");

		const toolbar = body.createEl("div");
		toolbar.classList.add("obsidian-reader-selection-toolbar");

		const checkboxBySourceIndex = new Map<number, HTMLInputElement>();
		const rowBySourceIndex = new Map<number, HTMLTableRowElement>();
		let noteBtn: HTMLButtonElement | null = null;
		let checkBtn: HTMLButtonElement | null = null;
		let synthesisBtn: HTMLButtonElement | null = null;
		let noteBtnLockedByProcessing = false;
		let checkBtnLockedByProcessing = false;
		let synthesisBtnLockedByProcessing = false;

		const getSelectedContentLength = () =>
			sections.reduce((total, section) => {
				if (!this.selectedSourceIndexes.has(section.sourceIndex)) return total;
				return total + (this.opts.sectionContentLengths?.[section.sourceIndex] ?? 0);
			}, 0);

		const updateGenerateButtonState = () => {
			const selectedLength = getSelectedContentLength();
			const hasSelection = this.selectedSourceIndexes.size > 0;
			const overLimit = selectedLength > MAX_READING_NOTE_INPUT_LENGTH;
			const disabled = !hasSelection || overLimit;

			if (noteBtn) noteBtn.disabled = noteBtnLockedByProcessing || disabled;
			if (checkBtn) checkBtn.disabled = checkBtnLockedByProcessing || disabled;
			if (synthesisBtn) {
				synthesisBtn.disabled = synthesisBtnLockedByProcessing || disabled;
			}

			noteStatusEl.textContent = getNoteButtonHint(
				generationActionLabel,
				hasSelection,
				selectedLength,
				overLimit
			);
			noteStatusEl.classList.toggle("is-error", overLimit);
		};

		const updateSelectionSummary = () => {
			const selectedSections = sections.filter((section) =>
				this.selectedSourceIndexes.has(section.sourceIndex)
			);
			const selectedDeep = selectedSections.filter(
				(section) =>
					this.currentTagBySourceIndex.get(section.sourceIndex) === "深读"
			).length;
			const selectedLight = selectedSections.length - selectedDeep;
			const selectedLength = getSelectedContentLength();
			const lengthText =
				selectedLength > 0
					? `，约 ${selectedLength}/${MAX_READING_NOTE_INPUT_LENGTH} 字`
					: "";

			selectionSummaryEl.textContent = `已选 ${selectedSections.length}/${sections.length} 节（深读 ${selectedDeep}，略读 ${selectedLight}${lengthText}）`;
			selectionSummaryEl.classList.toggle(
				"is-error",
				selectedLength > MAX_READING_NOTE_INPUT_LENGTH
			);
			updateGenerateButtonState();
			this.persistViewState();
		};

		const updateStrategySummary = () => {
			const deep = sections.filter(
				(section) =>
					this.currentTagBySourceIndex.get(section.sourceIndex) === "深读"
			).length;
			const light = sections.length - deep;
			strategySummaryEl.textContent = `共 ${sections.length} 节，深读 ${deep} 节，略读 ${light} 节`;
		};

		const applyRowStyle = (sourceIndex: number) => {
			const row = rowBySourceIndex.get(sourceIndex);
			const tag = this.currentTagBySourceIndex.get(sourceIndex);
			if (!row) return;
			row.classList.toggle("is-deep", tag === "深读");
			row.classList.toggle(
				"is-selected",
				this.selectedSourceIndexes.has(sourceIndex)
			);
		};

		const setSectionSelected = (sourceIndex: number, selected: boolean) => {
			if (selected) {
				this.selectedSourceIndexes.add(sourceIndex);
			} else {
				this.selectedSourceIndexes.delete(sourceIndex);
			}
			const checkbox = checkboxBySourceIndex.get(sourceIndex);
			if (checkbox) checkbox.checked = selected;
			applyRowStyle(sourceIndex);
			updateSelectionSummary();
		};

		const setSelectedSourceIndexes = (sourceIndexes: number[]) => {
			this.selectedSourceIndexes = new Set(sourceIndexes);
			for (const [sourceIndex, checkbox] of checkboxBySourceIndex) {
				checkbox.checked = this.selectedSourceIndexes.has(sourceIndex);
				applyRowStyle(sourceIndex);
			}
			updateSelectionSummary();
		};

		const selectWithinLimit = () => {
			const byPriority = [...sections].sort((a, b) => {
				const aDeep =
					this.currentTagBySourceIndex.get(a.sourceIndex) === "深读";
				const bDeep =
					this.currentTagBySourceIndex.get(b.sourceIndex) === "深读";
				if (aDeep !== bDeep) return aDeep ? -1 : 1;
				return (
					(sectionOrderBySourceIndex.get(a.sourceIndex) ?? 0) -
					(sectionOrderBySourceIndex.get(b.sourceIndex) ?? 0)
				);
			});
			let total = 0;
			const sourceIndexes: number[] = [];
			for (const section of byPriority) {
				const length =
					this.opts.sectionContentLengths?.[section.sourceIndex] ?? 0;
				if (length > MAX_READING_NOTE_INPUT_LENGTH) continue;
				if (total + length > MAX_READING_NOTE_INPUT_LENGTH) continue;
				sourceIndexes.push(section.sourceIndex);
				total += length;
			}
			setSelectedSourceIndexes(sourceIndexes);
		};

		const getSelectedSections = () =>
			sections
				.filter((section) =>
					this.selectedSourceIndexes.has(section.sourceIndex)
				)
				.map((section) => this.withCurrentTag(section));

		if (hasSectionSelection) {
			const quickGroup = toolbar.createEl("div");
			quickGroup.classList.add("obsidian-reader-button-group");

			for (const [label, handler] of [
				[
					"全选",
					() =>
						setSelectedSourceIndexes(
							sections.map((section) => section.sourceIndex)
						),
				],
				[
					"只选深读",
					() =>
						setSelectedSourceIndexes(
							sections
								.filter(
									(section) =>
										this.currentTagBySourceIndex.get(
											section.sourceIndex
										) === "深读"
								)
								.map((section) => section.sourceIndex)
						),
				],
				[
					"只选略读",
					() =>
						setSelectedSourceIndexes(
							sections
								.filter(
									(section) =>
										this.currentTagBySourceIndex.get(
											section.sourceIndex
										) === "略读"
								)
								.map((section) => section.sourceIndex)
						),
				],
				["选到上限", selectWithinLimit],
				["清空", () => setSelectedSourceIndexes([])],
			] as const) {
				const button = quickGroup.createEl("button", { text: label });
				button.addEventListener("click", handler);
			}

			const modeGroup = toolbar.createEl("label");
			modeGroup.classList.add("obsidian-reader-mode-control");
			modeGroup.createEl("span", { text: "笔记档位" });
			const modeSelect = modeGroup.createEl("select") as HTMLSelectElement;
			for (const mode of ["light", "standard", "deep"] as const) {
				const option = modeSelect.createEl("option") as HTMLOptionElement;
				option.value = mode;
				option.textContent = READING_NOTE_MODE_LABELS[mode];
			}
			modeSelect.value = this.readingNoteMode;
			modeSelect.addEventListener("change", () => {
				this.readingNoteMode = toReadingNoteMode(modeSelect.value);
				this.persistViewState();
			});
		}

		const tableWrap = body.createEl("div");
		tableWrap.classList.add("obsidian-reader-table-wrap");
		const table = tableWrap.createEl("table");
		table.classList.add("obsidian-reader-structure-table");

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		const headers = [
			...(hasSectionSelection ? ["笔记"] : []),
			"章节",
			"核心意思",
			"建议",
			...(onSectionAction ? ["操作"] : []),
		];
		for (const h of headers) {
			headerRow.createEl("th", { text: h });
		}

		const tbody = table.createEl("tbody");
		sections.forEach((section) => {
			const row = tbody.createEl("tr");
			rowBySourceIndex.set(section.sourceIndex, row);
			if (hasSectionSelection) {
				row.addEventListener("click", (event) => {
					if (isInteractiveTarget(event.target)) return;
					setSectionSelected(
						section.sourceIndex,
						!this.selectedSourceIndexes.has(section.sourceIndex)
					);
				});
			}

			if (hasSectionSelection) {
				const selectTd = row.createEl("td");
				selectTd.classList.add("obsidian-reader-select-cell");
				const checkbox = selectTd.createEl("input");
				checkbox.type = "checkbox";
				checkbox.checked = this.selectedSourceIndexes.has(
					section.sourceIndex
				);
				checkboxBySourceIndex.set(section.sourceIndex, checkbox);
				checkbox.addEventListener("change", () => {
					setSectionSelected(section.sourceIndex, checkbox.checked);
				});
			}

			const titleTd = row.createEl("td");
			titleTd.classList.add("obsidian-reader-title-cell");
			titleTd.createEl("strong", { text: section.title });

			const summaryTd = row.createEl("td", { text: section.summary });
			summaryTd.classList.add("obsidian-reader-summary-cell");

			const tagTd = row.createEl("td");
			const tagSelect = tagTd.createEl("select") as HTMLSelectElement;
			tagSelect.classList.add("obsidian-reader-tag-select");
			for (const tag of ["深读", "略读"] as const) {
				const option = tagSelect.createEl("option") as HTMLOptionElement;
				option.value = tag;
				option.textContent = tag;
			}
			tagSelect.value =
				this.currentTagBySourceIndex.get(section.sourceIndex) || section.tag;
			tagSelect.addEventListener("change", () => {
				const nextTag = tagSelect.value === "深读" ? "深读" : "略读";
				this.currentTagBySourceIndex.set(section.sourceIndex, nextTag);
				applyRowStyle(section.sourceIndex);
				updateSelectionSummary();
				updateStrategySummary();
			});

			if (onSectionAction) {
				const actionTd = row.createEl("td");
				actionTd.classList.add("obsidian-reader-action-cell");
				for (const [label, action] of [
					["压缩此节", "compress"],
					["展开此节", "expand"],
					["提问此节", "ask"],
					["理解检查", "check"],
				] as const) {
					const btn = actionTd.createEl("button", { text: label });
					btn.addEventListener("click", () => {
						onSectionAction(section.sourceIndex, action);
					});
				}
			}

			applyRowStyle(section.sourceIndex);
		});

		const highlightsPanel = body.createEl("section");
		highlightsPanel.classList.add("obsidian-reader-highlights");
		highlightsPanel.createEl("h4", { text: "最值得关注" });
		const ol = highlightsPanel.createEl("ol");
		for (const h of highlights) {
			ol.createEl("li", { text: h });
		}

		const footer = root.createEl("div");
		footer.classList.add("obsidian-reader-structure-footer");

		const copyBtn = footer.createEl("button", { text: "复制结构地图" });
		copyBtn.addEventListener("click", async () => {
			await navigator.clipboard.writeText(this.formatAsText());
			copyBtn.textContent = "已复制";
			setTimeout(() => {
				copyBtn.textContent = "复制结构地图";
			}, 1000);
		});

		if (onGenerateReadingNote) {
			const noteCallback = onGenerateReadingNote;
			noteBtn = footer.createEl("button", { text: "生成读书笔记" });
			noteBtn.addEventListener("click", async () => {
				if (!noteBtn || !canGenerate(this.selectedSourceIndexes.size, getSelectedContentLength())) {
					return;
				}
				noteBtnLockedByProcessing = true;
				updateGenerateButtonState();
				const originalText = noteBtn.textContent || "生成读书笔记";
				noteBtn.textContent = "生成中...";
				try {
					await noteCallback(getSelectedSections(), this.readingNoteMode);
				} finally {
					noteBtn.textContent = originalText;
					noteBtnLockedByProcessing = false;
					updateGenerateButtonState();
				}
			});
		}

		if (onGenerateReadingCheck) {
			const checkCallback = onGenerateReadingCheck;
			checkBtn = footer.createEl("button", { text: "生成理解检查" });
			checkBtn.addEventListener("click", async () => {
				if (!checkBtn || !canGenerate(this.selectedSourceIndexes.size, getSelectedContentLength())) {
					return;
				}
				checkBtnLockedByProcessing = true;
				updateGenerateButtonState();
				const originalText = checkBtn.textContent || "生成理解检查";
				checkBtn.textContent = "生成中...";
				try {
					await checkCallback(getSelectedSections(), this.readingNoteMode);
				} finally {
					checkBtn.textContent = originalText;
					checkBtnLockedByProcessing = false;
					updateGenerateButtonState();
				}
			});
		}

		if (onGenerateReadingSynthesis) {
			const synthesisCallback = onGenerateReadingSynthesis;
			synthesisBtn = footer.createEl("button", { text: "生成读后沉淀" });
			synthesisBtn.classList.add("mod-cta");
			synthesisBtn.addEventListener("click", async () => {
				if (
					!synthesisBtn ||
					!canGenerate(this.selectedSourceIndexes.size, getSelectedContentLength())
				) {
					return;
				}
				synthesisBtnLockedByProcessing = true;
				updateGenerateButtonState();
				const originalText = synthesisBtn.textContent || "生成读后沉淀";
				synthesisBtn.textContent = "生成中...";
				try {
					await synthesisCallback(getSelectedSections(), this.readingNoteMode);
				} finally {
					synthesisBtn.textContent = originalText;
					synthesisBtnLockedByProcessing = false;
					updateGenerateButtonState();
				}
			});
		}

		if (onInsert) {
			const insertCallback = onInsert;
			const insertBtn = footer.createEl("button", { text: "写入正文" });
			insertBtn.addEventListener("click", () => {
				insertCallback(this.sectionsWithCurrentTags(sections));
				insertBtn.textContent = "已写入";
				insertBtn.disabled = true;
			});
		}

		updateStrategySummary();
		updateSelectionSummary();
	}

	onClose() {
		this.persistViewState();
		for (const cleanup of this.cleanupHandlers.splice(0)) cleanup();
		this.contentEl.empty();
	}

	private configureModalShell() {
		this.getModalEl()?.classList.add("obsidian-reader-structure-modal");
		this.titleEl?.classList.add("obsidian-reader-hidden-title");
	}

	private getModalEl(): HTMLElement | null {
		return (this as unknown as { modalEl?: HTMLElement }).modalEl ?? null;
	}

	private enableDrag(handle: HTMLElement) {
		const modalEl = this.getModalEl();
		if (!modalEl) return;

		let dragging = false;
		let startX = 0;
		let startY = 0;
		let startLeft = 0;
		let startTop = 0;

		const onPointerMove = (event: PointerEvent) => {
			if (!dragging) return;
			modalEl.style.left = `${startLeft + event.clientX - startX}px`;
			modalEl.style.top = `${startTop + event.clientY - startY}px`;
			modalEl.style.transform = "none";
		};

		const onPointerUp = () => {
			dragging = false;
			modalEl.classList.remove("is-dragging");
		};

		const onPointerDown = (event: PointerEvent) => {
			if (isInteractiveTarget(event.target)) return;
			const rect = modalEl.getBoundingClientRect();
			dragging = true;
			startX = event.clientX;
			startY = event.clientY;
			startLeft = rect.left;
			startTop = rect.top;
			modalEl.style.position = "fixed";
			modalEl.style.left = `${rect.left}px`;
			modalEl.style.top = `${rect.top}px`;
			modalEl.style.margin = "0";
			modalEl.classList.add("is-dragging");
			event.preventDefault();
		};

		handle.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		this.cleanupHandlers.push(() => {
			handle.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		});
	}

	private buildInitialTagMap(
		sections: SectionAnalysis[]
	): Map<number, SectionAnalysis["tag"]> {
		const fromState = this.opts.initialViewState?.tagBySourceIndex ?? {};
		return new Map(
			sections.map((section) => [
				section.sourceIndex,
				fromState[section.sourceIndex] || section.tag,
			])
		);
	}

	private buildInitialSelection(sections: SectionAnalysis[]): Set<number> {
		const fromState = this.opts.initialViewState?.selectedSourceIndexes;
		if (fromState) return new Set(fromState);
		return new Set(
			sections
				.filter((section) => section.tag === "深读")
				.map((section) => section.sourceIndex)
		);
	}

	private persistViewState() {
		this.opts.onPersistViewState?.({
			selectedSourceIndexes: [...this.selectedSourceIndexes],
			tagBySourceIndex: Object.fromEntries(this.currentTagBySourceIndex),
			readingNoteMode: this.readingNoteMode,
		});
	}

	private formatAsText(): string {
		const { scope, result } = this.opts;
		const { sections, highlights } = result;
		const currentSections = this.sectionsWithCurrentTags(sections);
		const deep = currentSections.filter((section) => section.tag === "深读")
			.length;
		const light = currentSections.length - deep;
		const lines: string[] = ["## 结构地图", ""];

		lines.push(
			`- 分析范围：${scope}`,
			`- 章节统计：共 ${currentSections.length} 节，深读 ${deep} 节，略读 ${light} 节`,
			""
		);

		for (const s of currentSections) {
			lines.push(`- **${s.title}**（${s.tag}）：${s.summary}`);
		}

		lines.push("", "### 最值得关注", "");
		highlights.forEach((h, i) => {
			lines.push(`${i + 1}. ${h}`);
		});

		return lines.join("\n");
	}

	private sectionsWithCurrentTags(sections: SectionAnalysis[]): SectionAnalysis[] {
		return sections.map((section) => this.withCurrentTag(section));
	}

	private withCurrentTag(section: SectionAnalysis): SectionAnalysis {
		return {
			...section,
			tag: this.currentTagBySourceIndex.get(section.sourceIndex) || section.tag,
		};
	}
}

function getGenerationActionLabel(
	hasNote: boolean,
	hasCheck: boolean,
	hasSynthesis: boolean
): string {
	if (hasSynthesis) return "读后沉淀";
	if (hasNote && hasCheck) return "读书笔记 / 理解检查";
	if (hasCheck) return "理解检查";
	return "读书笔记";
}

function getNoteButtonHint(
	actionLabel: string,
	hasSelection: boolean,
	selectedLength: number,
	overLimit: boolean
) {
	if (!hasSelection) return `请选择至少一个章节后再生成${actionLabel}`;
	if (overLimit) {
		return `已超过${actionLabel}上限（${selectedLength}/${MAX_READING_NOTE_INPUT_LENGTH} 字），请减少勾选章节`;
	}
	return `可生成${actionLabel}（${selectedLength}/${MAX_READING_NOTE_INPUT_LENGTH} 字）`;
}

function canGenerate(selectionSize: number, selectedLength: number): boolean {
	return (
		selectionSize > 0 &&
		selectedLength <= MAX_READING_NOTE_INPUT_LENGTH
	);
}

function isInteractiveTarget(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		!!target.closest("button, select, input, textarea, a, label")
	);
}

function toReadingNoteMode(value: string): ReadingNoteMode {
	if (value === "light" || value === "deep") return value;
	return "standard";
}
