import { beforeEach, describe, expect, it, vi } from "vitest";
import { StructureMapModal } from "../../src/ui/structure-modal";
import type { StructureMapResult } from "../../src/types/structure";

const RESULT: StructureMapResult = {
	sections: [
		{
			sourceIndex: 2,
			title: "背景",
			summary: "介绍背景",
			tag: "略读",
		},
		{
			sourceIndex: 0,
			title: "核心论点",
			summary: "提出观点",
			tag: "深读",
		},
		{
			sourceIndex: 1,
			title: "例子",
			summary: "举例说明",
			tag: "略读",
		},
	],
	highlights: ["核心论点", "例子"],
};

function openModal(overrides: Partial<ConstructorParameters<typeof StructureMapModal>[1]> = {}) {
	const modal = new StructureMapModal({} as never, {
		scope: "整篇文档",
		result: RESULT,
		...overrides,
	});
	modal.onOpen();
	return modal;
}

function buttonByText(root: HTMLElement, text: string): HTMLButtonElement {
	const button = [...root.querySelectorAll("button")].find(
		(el) => el.textContent === text
	);
	if (!button) throw new Error(`Button not found: ${text}`);
	return button as HTMLButtonElement;
}

function checkboxes(root: HTMLElement): HTMLInputElement[] {
	return [...root.querySelectorAll("input[type='checkbox']")] as HTMLInputElement[];
}

function tagSelects(root: HTMLElement): HTMLSelectElement[] {
	return [...root.querySelectorAll("td select")] as HTMLSelectElement[];
}

function rows(root: HTMLElement): HTMLTableRowElement[] {
	return [...root.querySelectorAll("tbody tr")] as HTMLTableRowElement[];
}

describe("StructureMapModal", () => {
	beforeEach(() => {
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		});
	});

	it("默认只勾选深读章节，并用 sourceIndex 生成笔记", async () => {
		const onGenerateReadingNote = vi.fn();
		const modal = openModal({ onGenerateReadingNote });

		expect(checkboxes(modal.contentEl).map((input) => input.checked)).toEqual([
			false,
			true,
			false,
		]);
		expect(modal.contentEl.textContent).toContain(
			"已选 1/3 节（深读 1，略读 0）"
		);
		expect(modal.contentEl.textContent).toContain(
			"可生成读书笔记（0/30000 字）"
		);
		expect(modal.contentEl.textContent).toContain(
			"共 3 节，深读 1 节，略读 2 节"
		);

		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();

		expect(onGenerateReadingNote).toHaveBeenCalledWith([
			expect.objectContaining({ sourceIndex: 0, tag: "深读" }),
		], "standard");
	});

	it("生成理解检查按钮会使用 sourceIndex", async () => {
		const onGenerateReadingCheck = vi.fn();
		const modal = openModal({ onGenerateReadingCheck });

		expect(modal.contentEl.textContent).toContain(
			"可生成理解检查（0/30000 字）"
		);
		buttonByText(modal.contentEl, "生成理解检查").click();
		await Promise.resolve();

		expect(onGenerateReadingCheck).toHaveBeenCalledWith([
			expect.objectContaining({ sourceIndex: 0, tag: "深读" }),
		], "standard");
	});

	it("生成读后沉淀按钮会使用 sourceIndex", async () => {
		const onGenerateReadingSynthesis = vi.fn();
		const modal = openModal({ onGenerateReadingSynthesis });

		expect(modal.contentEl.textContent).toContain(
			"可生成读后沉淀（0/30000 字）"
		);
		buttonByText(modal.contentEl, "生成读后沉淀").click();
		await Promise.resolve();

		expect(onGenerateReadingSynthesis).toHaveBeenCalledWith([
			expect.objectContaining({ sourceIndex: 0, tag: "深读" }),
		], "standard");
	});

	it("全选、清空、只选深读、只选略读会更新生成笔记的 sourceIndex", async () => {
		const onGenerateReadingNote = vi.fn();
		const modal = openModal({ onGenerateReadingNote });

		buttonByText(modal.contentEl, "全选").click();
		expect(modal.contentEl.textContent).toContain(
			"已选 3/3 节（深读 1，略读 2）"
		);
		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();
		expect(onGenerateReadingNote).toHaveBeenLastCalledWith([
			expect.objectContaining({ sourceIndex: 2 }),
			expect.objectContaining({ sourceIndex: 0 }),
			expect.objectContaining({ sourceIndex: 1 }),
		], "standard");

		buttonByText(modal.contentEl, "清空").click();
		expect(modal.contentEl.textContent).toContain(
			"已选 0/3 节（深读 0，略读 0）"
		);
		expect(modal.contentEl.textContent).toContain(
			"请选择至少一个章节后再生成读书笔记"
		);
		expect(buttonByText(modal.contentEl, "生成读书笔记").disabled).toBe(true);
		expect(onGenerateReadingNote).toHaveBeenCalledTimes(1);

		buttonByText(modal.contentEl, "只选深读").click();
		expect(modal.contentEl.textContent).toContain(
			"已选 1/3 节（深读 1，略读 0）"
		);
		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();
		expect(onGenerateReadingNote).toHaveBeenLastCalledWith([
			expect.objectContaining({ sourceIndex: 0, tag: "深读" }),
		], "standard");

		buttonByText(modal.contentEl, "只选略读").click();
		expect(modal.contentEl.textContent).toContain(
			"已选 2/3 节（深读 0，略读 2）"
		);
		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();
		expect(onGenerateReadingNote).toHaveBeenLastCalledWith([
			expect.objectContaining({ sourceIndex: 2, tag: "略读" }),
			expect.objectContaining({ sourceIndex: 1, tag: "略读" }),
		], "standard");
	});

	it("选到上限会优先选择深读并控制在字数上限内", async () => {
		const onGenerateReadingNote = vi.fn();
		const modal = openModal({
			onGenerateReadingNote,
			sectionContentLengths: {
				0: 18000,
				1: 12000,
				2: 10000,
			},
		});

		buttonByText(modal.contentEl, "选到上限").click();
		expect(modal.contentEl.textContent).toContain(
			"已选 2/3 节（深读 1，略读 1，约 28000/30000 字）"
		);

		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();

		expect(onGenerateReadingNote).toHaveBeenCalledWith([
			expect.objectContaining({ sourceIndex: 2, tag: "略读" }),
			expect.objectContaining({ sourceIndex: 0, tag: "深读" }),
		], "standard");
	});

	it("显示已选原文字数，并在超过上限时禁用生成读书笔记", async () => {
		const onGenerateReadingNote = vi.fn();
		const modal = openModal({
			onGenerateReadingNote,
			sectionContentLengths: {
				0: 20000,
				1: 12000,
				2: 1000,
			},
		});

		expect(modal.contentEl.textContent).toContain(
			"已选 1/3 节（深读 1，略读 0，约 20000/30000 字）"
		);
		expect(modal.contentEl.textContent).toContain(
			"可生成读书笔记（20000/30000 字）"
		);
		expect(buttonByText(modal.contentEl, "生成读书笔记").disabled).toBe(false);

		buttonByText(modal.contentEl, "全选").click();
		expect(modal.contentEl.textContent).toContain(
			"已选 3/3 节（深读 1，略读 2，约 33000/30000 字）"
		);
		expect(modal.contentEl.textContent).toContain(
			"已超过读书笔记上限（33000/30000 字），请减少勾选章节"
		);
		expect(buttonByText(modal.contentEl, "生成读书笔记").disabled).toBe(true);

		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();
		expect(onGenerateReadingNote).toHaveBeenCalledTimes(0);
	});

	it("手动切换 checkbox 会影响生成笔记参数", async () => {
		const onGenerateReadingNote = vi.fn();
		const modal = openModal({ onGenerateReadingNote });
		const inputs = checkboxes(modal.contentEl);

		inputs[0].checked = true;
		inputs[0].dispatchEvent(new Event("change"));
		inputs[1].checked = false;
		inputs[1].dispatchEvent(new Event("change"));
		expect(modal.contentEl.textContent).toContain(
			"已选 1/3 节（深读 0，略读 1）"
		);

		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();

		expect(onGenerateReadingNote).toHaveBeenCalledWith([
			expect.objectContaining({ sourceIndex: 2, tag: "略读" }),
		], "standard");
	});

	it("点击章节行会切换该章节勾选状态", () => {
		const modal = openModal({ onGenerateReadingNote: vi.fn() });
		const inputs = checkboxes(modal.contentEl);
		const tableRows = rows(modal.contentEl);

		expect(inputs[0].checked).toBe(false);
		tableRows[0].click();
		expect(inputs[0].checked).toBe(true);
		expect(modal.contentEl.textContent).toContain(
			"已选 2/3 节（深读 1，略读 1）"
		);

		tableRows[0].click();
		expect(inputs[0].checked).toBe(false);
		expect(modal.contentEl.textContent).toContain(
			"已选 1/3 节（深读 1，略读 0）"
		);
	});

	it("手动切换深读/略读后，生成笔记使用调整后的 tag", async () => {
		const onGenerateReadingNote = vi.fn();
		const modal = openModal({ onGenerateReadingNote });
		const inputs = checkboxes(modal.contentEl);
		const selects = tagSelects(modal.contentEl);

		selects[0].value = "深读";
		selects[0].dispatchEvent(new Event("change"));
		inputs[0].checked = true;
		inputs[0].dispatchEvent(new Event("change"));
		expect(modal.contentEl.textContent).toContain(
			"共 3 节，深读 2 节，略读 1 节"
		);
		expect(modal.contentEl.textContent).toContain(
			"已选 2/3 节（深读 2，略读 0）"
		);

		selects[1].value = "略读";
		selects[1].dispatchEvent(new Event("change"));
		expect(modal.contentEl.textContent).toContain(
			"共 3 节，深读 1 节，略读 2 节"
		);
		expect(modal.contentEl.textContent).toContain(
			"已选 2/3 节（深读 1，略读 1）"
		);

		buttonByText(modal.contentEl, "只选深读").click();
		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();

		expect(onGenerateReadingNote).toHaveBeenCalledWith([
			expect.objectContaining({ sourceIndex: 2, tag: "深读" }),
		], "standard");
	});

	it("切换笔记档位后传给生成回调", async () => {
		const onGenerateReadingNote = vi.fn();
		const modal = openModal({ onGenerateReadingNote });
		const modeSelect = [...modal.contentEl.querySelectorAll("div select")][0] as
			| HTMLSelectElement
			| undefined;

		if (!modeSelect) throw new Error("Mode select not found");
		modeSelect.value = "deep";
		modeSelect.dispatchEvent(new Event("change"));

		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();

		expect(onGenerateReadingNote).toHaveBeenCalledWith(
			[expect.objectContaining({ sourceIndex: 0 })],
			"deep"
		);
	});

	it("使用传入的默认读书笔记档位", async () => {
		const onGenerateReadingNote = vi.fn();
		const modal = openModal({
			defaultReadingNoteMode: "light",
			onGenerateReadingNote,
		});
		const modeSelect = [...modal.contentEl.querySelectorAll("div select")][0] as
			| HTMLSelectElement
			| undefined;

		if (!modeSelect) throw new Error("Mode select not found");
		expect(modeSelect.value).toBe("light");

		buttonByText(modal.contentEl, "生成读书笔记").click();
		await Promise.resolve();

		expect(onGenerateReadingNote).toHaveBeenCalledWith(
			[expect.objectContaining({ sourceIndex: 0 })],
			"light"
		);
	});

	it("章节操作按钮使用 section.sourceIndex", () => {
		const onSectionAction = vi.fn();
		const modal = openModal({ onSectionAction });

		buttonByText(modal.contentEl, "压缩此节").click();
		buttonByText(modal.contentEl, "展开此节").click();
		buttonByText(modal.contentEl, "提问此节").click();

		expect(onSectionAction).toHaveBeenNthCalledWith(1, 2, "compress");
		expect(onSectionAction).toHaveBeenNthCalledWith(2, 2, "expand");
		expect(onSectionAction).toHaveBeenNthCalledWith(3, 2, "ask");
	});

	it("复制结构地图会写入剪贴板", async () => {
		const modal = openModal();

		buttonByText(modal.contentEl, "复制结构地图").click();
		await Promise.resolve();

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("## 结构地图")
		);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("- 分析范围：整篇文档")
		);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("- 章节统计：共 3 节，深读 1 节，略读 2 节")
		);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("- **核心论点**（深读）：提出观点")
		);
	});

	it("复制结构地图使用弹窗内调整后的深读/略读状态", async () => {
		const modal = openModal();
		const selects = tagSelects(modal.contentEl);

		selects[0].value = "深读";
		selects[0].dispatchEvent(new Event("change"));

		buttonByText(modal.contentEl, "复制结构地图").click();
		await Promise.resolve();

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("- **背景**（深读）：介绍背景")
		);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			expect.stringContaining("- 章节统计：共 3 节，深读 2 节，略读 1 节")
		);
	});

	it("写入正文按钮调用 onInsert 并禁用按钮", () => {
		const onInsert = vi.fn();
		const modal = openModal({ onInsert });
		const button = buttonByText(modal.contentEl, "写入正文");

		button.click();

		expect(onInsert).toHaveBeenCalledWith([
			expect.objectContaining({ sourceIndex: 2, tag: "略读" }),
			expect.objectContaining({ sourceIndex: 0, tag: "深读" }),
			expect.objectContaining({ sourceIndex: 1, tag: "略读" }),
		]);
		expect(button.disabled).toBe(true);
		expect(button.textContent).toBe("已写入");
	});

	it("关闭时清空 contentEl", () => {
		const modal = openModal();

		expect(modal.contentEl.childElementCount).toBeGreaterThan(0);
		modal.onClose();

		expect(modal.contentEl.childElementCount).toBe(0);
	});
});
