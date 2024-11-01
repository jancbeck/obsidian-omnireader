import {
	EditorState,
	Transaction,
	StateField,
	StateEffect,
	Extension,
	Text,
	type Range,
} from "@codemirror/state";
import {
	EditorView,
	Decoration,
	DecorationSet,
	WidgetType,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { createRoot } from "react-dom/client";
import AnnotationPopover from "./AnnotationPopover";

let currentPopover: { root: any; container: HTMLElement } | null = null;

interface HighlightMatch {
	from: number;
	to: number;
	highlightText: string;
	comment?: string; // Optional comment
	fullMatch: string;
	hasAnnotation: boolean;
}

class HighlightWidget extends WidgetType {
	constructor(
		private highlightText: string,
		private comment: string | undefined,
		private from: number,
		private to: number,
		private hasAnnotation: boolean
	) {
		super();
	}

	eq(other: HighlightWidget) {
		return (
			this.highlightText === other.highlightText &&
			this.comment === other.comment &&
			this.from === other.from &&
			this.to === other.to &&
			this.hasAnnotation === other.hasAnnotation
		);
	}

	toDOM(view: EditorView) {
		const wrapper = document.createElement("span");
		wrapper.className = this.hasAnnotation
			? "obsidian-highlight annotated"
			: "obsidian-highlight";
		wrapper.textContent = this.highlightText;

		// Store metadata
		wrapper.setAttribute("data-from", String(this.from));
		wrapper.setAttribute("data-to", String(this.to));
		if (this.comment) {
			wrapper.setAttribute("data-comment", this.comment);
		}

		wrapper.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showPopover(e, view);
		});

		// Add tooltip if there's a comment
		if (this.comment) {
			wrapper.title = this.comment;
		}

		return wrapper;
	}

	private showPopover(event: MouseEvent, view: EditorView) {
		// Remove any existing popover
		this.removeCurrentPopover();

		// Create container for the popover
		const container = document.createElement("div");
		document.body.appendChild(container);

		// Calculate position relative to the click
		const position = {
			x: event.clientX,
			y: event.clientY,
		};

		// Create React root and render popover
		const root = createRoot(container);
		root.render(
			<AnnotationPopover
				initialComment={this.comment || ""}
				position={position}
				onSave={(newComment: string) => {
					this.handleAnnotationUpdate(newComment, view);
					this.removeCurrentPopover();
				}}
				onClose={() => {
					this.removeCurrentPopover();
				}}
			/>
		);

		// Store current popover reference
		currentPopover = { root, container };
	}

	private removeCurrentPopover() {
		if (currentPopover) {
			currentPopover.root.unmount();
			currentPopover.container.remove();
			currentPopover = null;
		}
	}

	private handleAnnotationUpdate(newComment: string, view: EditorView) {
		let newText: string;
		if (newComment.trim() === "") {
			newText = `==${this.highlightText}==`;
		} else {
			newText = `==${this.highlightText}==<!--${newComment}-->`;
		}

		const transaction = view.state.update({
			changes: {
				from: this.from,
				to: this.to,
				insert: newText,
			},
		});
		view.dispatch(transaction);
	}
}

function findHighlightsAndAnnotations(doc: Text): HighlightMatch[] {
	const matches: HighlightMatch[] = [];

	// Two regex patterns: one for highlights with annotations, one for just highlights
	const annotatedRegex = /==([^=]+)==<!--([^>]*)-->/g;
	const highlightRegex = /==([^=]+)==(?!<!--)/g; // Negative lookahead to avoid matching annotated ones

	// Process each line
	for (let i = 1; i <= doc.lines; i++) {
		const line = doc.line(i);
		const lineText = line.text;

		// First find annotated highlights
		annotatedRegex.lastIndex = 0;
		let match;
		while ((match = annotatedRegex.exec(lineText)) !== null) {
			matches.push({
				from: line.from + match.index,
				to: line.from + match.index + match[0].length,
				highlightText: match[1],
				comment: match[2],
				fullMatch: match[0],
				hasAnnotation: true,
			});
		}

		// Then find standalone highlights
		highlightRegex.lastIndex = 0;
		while ((match = highlightRegex.exec(lineText)) !== null) {
			matches.push({
				from: line.from + match.index,
				to: line.from + match.index + match[0].length,
				highlightText: match[1],
				fullMatch: match[0],
				hasAnnotation: false,
			});
		}
	}

	return matches;
}

function createHighlightDecorations(state: EditorState): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const matches = findHighlightsAndAnnotations(state.doc);

	for (const match of matches) {
		const deco = Decoration.replace({
			widget: new HighlightWidget(
				match.highlightText,
				match.comment,
				match.from,
				match.to,
				match.hasAnnotation
			),
		}).range(match.from, match.to);

		decorations.push(deco);
	}

	return Decoration.set(decorations, true);
}

export function highlightExtension(): Extension {
	const highlightField = StateField.define<DecorationSet>({
		create(state) {
			return createHighlightDecorations(state);
		},
		update(decorations, transaction) {
			if (transaction.docChanged) {
				return createHighlightDecorations(transaction.state);
			}
			return decorations.map(transaction.changes);
		},
		provide: (f) => EditorView.decorations.from(f),
	});

	return [
		highlightField,
		EditorView.baseTheme({
			".obsidian-highlight": {
				backgroundColor: "rgba(255, 255, 0, 0.2)",
				cursor: "pointer",
				borderRadius: "3px",
				padding: "0 2px",
				transition: "background-color 0.2s",
			},
			".obsidian-highlight.annotated": {
				backgroundColor: "rgba(255, 255, 0, 0.3)",
				borderBottom: "1px dotted #999",
			},
			".obsidian-highlight:hover": {
				backgroundColor: "rgba(255, 255, 0, 0.4)",
			},
		}),
	];
}

// Helper function to create a new highlight
export function createHighlight(view: EditorView) {
	const selection = view.state.selection.main;
	if (selection.empty) return false;

	const selectedText = view.state.doc.sliceString(
		selection.from,
		selection.to
	);
	const highlightText = `==${selectedText}==`;

	const transaction = view.state.update({
		changes: {
			from: selection.from,
			to: selection.to,
			insert: highlightText,
		},
	});

	view.dispatch(transaction);
	return true;
}

export function cleanup() {
	if (currentPopover) {
		currentPopover.root.unmount();
		currentPopover.container.remove();
		currentPopover = null;
	}
}
