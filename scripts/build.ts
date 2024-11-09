const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const result = await Bun.build({
	entrypoints: ["./src/main.ts"],
	outdir: "./build",
	format: "cjs",
	external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
	minify: true,
	loader: {
		".json": "file",
	},
	naming: {
		asset: "[name].[ext]",
	},
	banner,
});

if (!result.success) {
	console.error("Build failed");
	for (const message of result.logs) {
		// Bun will pretty print the message object
		console.error(message);
	}
}

export { result };
