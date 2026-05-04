import { describe, it, expect } from "vitest";
import { parseJsonObject, stringArray } from "../../../src/core/ai/parse";

describe("parseJsonObject", () => {
	it("解析普通 JSON object", () => {
		const result = parseJsonObject('{"a":1}', "格式错误");

		expect(result).toEqual({ a: 1 });
	});

	it("解析 markdown json 代码块中的 object", () => {
		const result = parseJsonObject("```json\n{\"a\":1}\n```", "格式错误");

		expect(result).toEqual({ a: 1 });
	});

	it("解析夹在说明文本中的 JSON object", () => {
		const result = parseJsonObject(
			"下面是结果：\n{\"a\":\"含有 } 的字符串\",\"b\":{\"c\":1}}\n请查收",
			"格式错误"
		);

		expect(result).toEqual({ a: "含有 } 的字符串", b: { c: 1 } });
	});

	it("非 object JSON 抛出传入的错误文案", () => {
		expect(() => parseJsonObject("[1,2,3]", "格式错误")).toThrow(
			"格式错误"
		);
	});

	it("非法 JSON 抛出传入的错误文案", () => {
		expect(() => parseJsonObject("不是 JSON", "格式错误")).toThrow(
			"格式错误"
		);
	});
});

describe("stringArray", () => {
	it("数组元素统一转字符串", () => {
		expect(stringArray(["a", 1, true])).toEqual(["a", "1", "true"]);
	});

	it("非数组返回空数组", () => {
		expect(stringArray("a")).toEqual([]);
	});
});
