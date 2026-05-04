import type { SectionAnalysis } from "./structure";

export type ReadingNoteMode = "light" | "standard" | "deep";

export const READING_NOTE_MODE_LABELS: Record<ReadingNoteMode, string> = {
	light: "轻量",
	standard: "标准",
	deep: "深度",
};

export interface NoteSourceSection {
	sourceIndex: number;
	title: string;
	tag: SectionAnalysis["tag"];
	content: string;
}

export interface GenerateReadingNoteOptions {
	mode?: ReadingNoteMode;
	readingCheckContext?: ReadingCheckContext;
}

export interface ReadingCheckContext {
	summary: string;
	checkpoints: string[];
	blindSpots: string[];
	questions: string[];
}

export interface ReadingNoteResult {
	summary: string;
	memorablePoints: string[];
	connections: string[];
	questions: string[];
	markdown: string;
	mode: ReadingNoteMode;
	sourceTitles: string[];
}
