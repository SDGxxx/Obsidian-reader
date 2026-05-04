import esbuild from "esbuild";
import builtinModules from "builtin-modules";

const production = process.argv[2] === "production";

esbuild
	.build({
		entryPoints: ["src/main.ts"],
		bundle: true,
		external: [
			"obsidian",
			"electron",
			"@codemirror/autocomplete",
			"@codemirror/collab",
			"@codemirror/commands",
			"@codemirror/language",
			"@codemirror/lint",
			"@codemirror/search",
			"@codemirror/state",
			"@codemirror/view",
			"@lezer/common",
			"@lezer/highlight",
			"@lezer/lr",
			...builtinModules,
		],
		format: "cjs",
		target: "es2018",
		logLevel: "info",
		sourcemap: production ? false : "inline",
		treeShaking: true,
		outfile: "main.js",
		minify: production,
		loader: { ".md": "text" },
	})
	.catch(() => process.exit(1));
