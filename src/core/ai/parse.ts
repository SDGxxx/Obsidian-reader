export function parseJsonObject(raw: string, errorMessage: string): unknown {
	let jsonStr = raw;
	const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
	if (codeBlockMatch) {
		jsonStr = codeBlockMatch[1];
	}

	const directParsed = tryParseObject(jsonStr);
	if (directParsed) return directParsed;

	const candidate = extractJsonObjectCandidate(jsonStr);
	if (candidate) {
		const candidateParsed = tryParseObject(candidate);
		if (candidateParsed) return candidateParsed;
	}

	throw new Error(errorMessage);
}

function tryParseObject(jsonStr: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(jsonStr);
		if (!isRecord(parsed)) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function extractJsonObjectCandidate(raw: string): string | null {
	const start = raw.indexOf("{");
	if (start === -1) return null;

	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = start; index < raw.length; index++) {
		const char = raw[index];

		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === "\"") {
				inString = false;
			}
			continue;
		}

		if (char === "\"") {
			inString = true;
			continue;
		}
		if (char === "{") {
			depth += 1;
			continue;
		}
		if (char === "}") {
			depth -= 1;
			if (depth === 0) {
				return raw.slice(start, index + 1);
			}
		}
	}

	return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map(String);
}
