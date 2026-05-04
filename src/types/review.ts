import type { ReadingNoteMode } from "./note";

export interface GenerateReadingCheckOptions {
	mode?: ReadingNoteMode;
}

export interface ReadingCheckResult {
	summary: string;
	checkpoints: string[];
	blindSpots: string[];
	questions: string[];
	markdown: string;
	mode: ReadingNoteMode;
	sourceTitles: string[];
}
