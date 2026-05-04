import { describe, expect, it, vi } from "vitest";
import { AskInputModal } from "../../src/ui/ask-input-modal";

function openModal(onSubmit = vi.fn()) {
	const modal = new AskInputModal({} as never, onSubmit);
	modal.onOpen();
	return { modal, onSubmit };
}

function submitButton(root: HTMLElement): HTMLButtonElement {
	const button = [...root.querySelectorAll("button")].find(
		(el) => el.textContent === "提问"
	);
	if (!button) throw new Error("Submit button not found");
	return button as HTMLButtonElement;
}

describe("AskInputModal", () => {
	it("空问题提交时显示错误且不提交", () => {
		const { modal, onSubmit } = openModal();
		const errorEl = [...modal.contentEl.querySelectorAll("p")].find(
			(el) => el.textContent === "请输入问题"
		) as HTMLParagraphElement;

		submitButton(modal.contentEl).click();

		expect(errorEl.style.display).toBe("block");
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("有效问题提交时 trim 并关闭弹窗", () => {
		const { modal, onSubmit } = openModal();
		const closeSpy = vi.spyOn(modal, "close");
		const input = modal.contentEl.querySelector("textarea")!;

		input.value = "  这段在说什么？  ";
		input.dispatchEvent(new Event("input"));
		submitButton(modal.contentEl).click();

		expect(closeSpy).toHaveBeenCalledOnce();
		expect(onSubmit).toHaveBeenCalledWith("这段在说什么？");
	});

	it("关闭时清空内容", () => {
		const { modal } = openModal();

		modal.onClose();

		expect(modal.contentEl.childElementCount).toBe(0);
	});
});
