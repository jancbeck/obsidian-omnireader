import type { MarkdownPostProcessorContext } from "obsidian";
import { createRoot } from "react-dom/client";
import MarginNote from "./note";

let counter = 0;

export default (
	element: HTMLElement,
	{ getSectionInfo }: MarkdownPostProcessorContext
) => {
	const marks = element.findAll("mark");
	if (!marks.length) return;
	const section = getSectionInfo(element);
	if (!section) return;

	const containerEl = element.closest(
		".markdown-preview-section"
	) as HTMLElement | null;
	if (!containerEl) return;

	const { text, lineStart, lineEnd } = section;
	const unprocessedElement = text
		.split("\n")
		.slice(lineStart, lineEnd + 1)
		.join();
	let matchIndex = 0;

	for (const mark of marks) {
		const matches = unprocessedElement.match(
			new RegExp(`==(${mark.innerText})==<!--([^>]*)-->`, "g")
		);
		if (!matches?.length) continue;
		// if there are multiple matches in the same line
		// we pick the first one and then increment the index
		// so that the next match is the next one
		if (matches.length > 1 && !matchIndex) {
			matchIndex++;
		} else {
			matchIndex = 0;
		}
		const comment = matches[matchIndex].match(/<!--([^>]*)-->/)?.[1];
		if (!comment) continue;

		mark.createEl("h1", { text: "Heading 1" });

		// Create React root and render margin note
		element.addClass("relative");
		const root = createRoot(
			element.appendChild(document.createElement("div"))
		);

		root.render(
			<MarginNote
				comment={comment}
				position={counter % 2 ? "left" : "right"}
			/>
		);
		counter++;

		mark.setAttribute("title", comment);
	}
};
