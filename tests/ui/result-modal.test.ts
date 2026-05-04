import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultModal } from "../../src/ui/result-modal";

function openModal(overrides: Partial<ConstructorParameters<typeof ResultModal>[1]> = {}) {
	const modal = new ResultModal({} as never, {
		title: "压缩结果",
		scope: "当前段落",
		sections: [
			{ label: "原文", text: "第一行\n第二行" },
			{ label: "压缩后", text: "结果" },
		],
		copyText: "结果",
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

describe("ResultModal", () => {
	beforeEach(() => {
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		});
	});

	it("展示标题、范围和内容区块", () => {
		const modal = openModal();

		expect(modal.contentEl.querySelector("h3")?.textContent).toBe(
			"压缩结果 — 当前段落"
		);
		expect([...modal.contentEl.querySelectorAll("h4")].map((el) => el.textContent)).toEqual([
			"原文",
			"压缩后",
		]);
		expect(modal.contentEl.textContent).toContain("第一行\n第二行");
	});

	it("复制结果写入剪贴板并更新按钮文案", async () => {
		vi.useFakeTimers();
		const modal = openModal();
		const button = buttonByText(modal.contentEl, "复制结果");

		button.click();
		await Promise.resolve();

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith("结果");
		vi.runAllTimers();
		expect(button.textContent).toBe("复制结果");
		vi.useRealTimers();
	});

	it("有 onInsert 时显示写入按钮，点击后禁用", () => {
		const onInsert = vi.fn();
		const modal = openModal({ onInsert });
		const button = buttonByText(modal.contentEl, "写入正文");

		button.click();

		expect(onInsert).toHaveBeenCalledOnce();
		expect(button.disabled).toBe(true);
		expect(button.textContent).toBe("已写入");
	});

	it("没有 onInsert 时不显示写入按钮", () => {
		const modal = openModal({ onInsert: undefined });

		expect(
			[...modal.contentEl.querySelectorAll("button")].some(
				(button) => button.textContent === "写入正文"
			)
		).toBe(false);
	});

	it("有 onInsertMarkdown 时显示标题块写入按钮，点击后禁用", () => {
		const onInsertMarkdown = vi.fn();
		const modal = openModal({ onInsertMarkdown });
		const button = buttonByText(modal.contentEl, "写入为标题块");

		button.click();

		expect(onInsertMarkdown).toHaveBeenCalledOnce();
		expect(button.disabled).toBe(true);
		expect(button.textContent).toBe("已写入");
	});

	it("关闭时清空内容", () => {
		const modal = openModal();

		modal.onClose();

		expect(modal.contentEl.childElementCount).toBe(0);
	});
});
