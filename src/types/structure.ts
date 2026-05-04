export interface SectionAnalysis {
	/** 对应输入章节的 0-based 下标，用于回到原文执行章节操作 */
	sourceIndex: number;
	title: string;
	summary: string;
	tag: "深读" | "略读";
}

export interface StructureMapResult {
	sections: SectionAnalysis[];
	highlights: string[];
}

export interface StructureMapViewState {
	selectedSourceIndexes: number[];
	tagBySourceIndex: Record<number, SectionAnalysis["tag"]>;
	readingNoteMode: "light" | "standard" | "deep";
}

export interface LastStructureMapSession {
	label: string;
	scope: string;
	reopen: () => void;
}
