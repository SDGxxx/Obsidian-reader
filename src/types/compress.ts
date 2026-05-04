import type { ReadingNoteMode } from "./note";

export interface CompressResult {
	/** 用户原始输入文本（未经 trim） */
	original: string;
	/** 压缩后文本（基于 trim 后的内容压缩） */
	compressed: string;
	/**
	 * 压缩比 = compressed.length / normalized.length
	 * 其中 normalized = original.trim()
	 * 范围 0~1，空字符串时为 0，保留两位小数
	 */
	ratio: number;
}

export type AuthMode = "apiKey" | "authToken";

export interface PluginSettings {
	baseURL: string;
	authMode: AuthMode;
	secret: string;
	rememberSecret: boolean;
	model: string;
	defaultReadingNoteMode: ReadingNoteMode;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	baseURL: "https://api.anthropic.com",
	authMode: "apiKey",
	secret: "",
	rememberSecret: true,
	model: "claude-sonnet-4-6",
	defaultReadingNoteMode: "standard",
};
