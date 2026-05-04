import type { PluginSettings } from "../types/compress";
import type { LastStructureMapSession } from "../types/structure";

export interface CommandRuntime {
	getSettings(): PluginSettings;
	isProcessing(): boolean;
	setProcessing(value: boolean): void;
	getLastStructureMapSession?: () => LastStructureMapSession | null;
	setLastStructureMapSession?: (session: LastStructureMapSession) => void;
}
