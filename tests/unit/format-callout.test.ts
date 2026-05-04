import { describe, it, expect } from "vitest";
import { formatAsCallout, isCodeBlock } from "../../src/core/format";

describe("formatAsCallout", () => {
	it("单行文本：生成正确的 callout", () => {
		const result = formatAsCallout("压缩后的一句话");

		expect(result).toBe(
			"> [!summary] 压缩结果\n> 压缩后的一句话"
		);
	});

	it("多行文本：每行都有 > 前缀", () => {
		const result = formatAsCallout("第一行\n第二行\n第三行");

		expect(result).toBe(
			"> [!summary] 压缩结果\n> 第一行\n> 第二行\n> 第三行"
		);
		for (const line of result.split("\n")) {
			expect(line.startsWith("> ")).toBe(true);
		}
	});

	it("自定义标题", () => {
		const result = formatAsCallout("内容", "展开结果");

		expect(result).toBe("> [!summary] 展开结果\n> 内容");
	});
});

describe("isCodeBlock", () => {
	it("被 ``` 包裹的文本识别为代码块", () => {
		expect(isCodeBlock("```js\nconst x = 1;\n```")).toBe(true);
	});

	it("普通中文段落不是代码块", () => {
		expect(isCodeBlock("这是一段普通的中文文本，用来测试。")).toBe(false);
	});

	it("超过一半行是代码特征时识别为代码块", () => {
		const code = "const a = 1;\nconst b = 2;\nconst c = 3;\n// comment";
		expect(isCodeBlock(code)).toBe(true);
	});

	it("空字符串不是代码块", () => {
		expect(isCodeBlock("")).toBe(false);
	});
});
