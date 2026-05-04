import type { RawSection } from "../parser/sections";
import type { NoteSourceSection } from "../../types/note";
import type { SectionAnalysis } from "../../types/structure";

export function normalizeSourceIndexes(sourceIndexes: number[]): number[] {
	return [...new Set(sourceIndexes)].sort((a, b) => a - b);
}

export function buildNoteSourceSections(
	rawSections: RawSection[],
	analyses: SectionAnalysis[],
	sourceIndexes: number[]
): NoteSourceSection[] {
	const analysisBySourceIndex = new Map(
		analyses.map((analysis) => [analysis.sourceIndex, analysis])
	);

	return normalizeSourceIndexes(sourceIndexes)
		.map((sourceIndex) => {
			const raw = rawSections[sourceIndex];
			const analysis = analysisBySourceIndex.get(sourceIndex);
			if (!raw || !analysis) return null;

			return {
				sourceIndex,
				title: analysis.title || raw.title,
				tag: analysis.tag,
				content: raw.content,
			};
		})
		.filter((section): section is NoteSourceSection => section !== null);
}

export function getLastSelectedEndLine(
	noteSections: NoteSourceSection[],
	rawSections: RawSection[],
	defaultInsertLine: number
): number {
	if (noteSections.length === 0) return defaultInsertLine;

	return Math.max(
		...noteSections.map(
			(section) =>
				rawSections[section.sourceIndex]?.endLine ?? defaultInsertLine
		)
	);
}

export function formatList(items: string[]): string {
	if (items.length === 0) return "无";
	return items.map((item) => `- ${item}`).join("\n");
}
