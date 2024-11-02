import {
	EditorState,
	StateField,
	Extension,
	Text,
	StateEffect,
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
import { createRoot, type Root } from "react-dom/client";
import AnnotationPopover from "./popover";
import allColorNames from "../colors";

let currentPopover: { root: Root; container: HTMLElement } | null = null;
const ShowPopoverEffect = StateEffect.define<{ from: number; to: number }>();

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
		private hasAnnotation: boolean,
		private wrapperEl?: HTMLElement
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
			? "omnireader-highlight annotated"
			: "omnireader-highlight";
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
			this.showPopover(view);
		});

		// Add tooltip if there's a comment
		if (this.comment) {
			wrapper.title = this.comment;
		}

		this.wrapperEl = wrapper;

		return wrapper;
	}

	public showPopover(view: EditorView) {
		if (!this.wrapperEl) return;

		// Remove any existing popover
		this.removeCurrentPopover();

		// Create container for the popover
		const container = document.createElement("div");
		document.body.appendChild(container);

		// Calculate position relative to the click
		const position = {
			x:
				this.wrapperEl.getBoundingClientRect().left +
				this.wrapperEl.offsetWidth / 2,
			y: this.wrapperEl.getBoundingClientRect().top,
		};

		// Create React root and render popover
		const root = createRoot(container);
		root.render(
			<AnnotationPopover
				initialComment={this.comment || ""}
				position={position}
				onSave={({ comment, remove }) => {
					if (remove) {
						this.handleAnnotationRemoval(view);
					}
					if (typeof comment !== "undefined") {
						this.handleAnnotationUpdate(comment, view);
					}
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

	private handleAnnotationRemoval(view: EditorView) {
		const transaction = view.state.update({
			changes: {
				from: this.from,
				to: this.to,
				insert: this.highlightText,
			},
		});
		view.dispatch(transaction);
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
	const docText = doc.toString();

	const annotatedRegex = /==([^=]+)==<!--([\s\S]*?)-->/gm;
	const highlightRegex = /==(?!<!--)([^=]+)==(?!<!--)/gm;

	// Find annotated highlights
	let match;
	while ((match = annotatedRegex.exec(docText)) !== null) {
		matches.push({
			from: match.index,
			to: match.index + match[0].length,
			highlightText: match[1],
			comment: match[2],
			fullMatch: match[0],
			hasAnnotation: true,
		});
	}

	// Find standalone highlights
	while ((match = highlightRegex.exec(docText)) !== null) {
		matches.push({
			from: match.index,
			to: match.index + match[0].length,
			highlightText: match[1],
			fullMatch: match[0],
			hasAnnotation: false,
		});
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

	// Add ViewPlugin to handle the effect
	const highlightPlugin = ViewPlugin.fromClass(
		class {
			update(update: ViewUpdate) {
				for (const effect of update.transactions[0]?.effects || []) {
					if (effect.is(ShowPopoverEffect)) {
						const decorations = update.state.field(highlightField);
						decorations.between(
							effect.value.from,
							effect.value.to,
							(from, to, deco) => {
								if (
									deco.spec.widget instanceof HighlightWidget
								) {
									setTimeout(
										() =>
											deco.spec.widget.showPopover(
												update.view
											),
										0
									);
								}
							}
						);
					}
				}
			}
		}
	);

	return [highlightField, highlightPlugin];
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
		effects: [
			ShowPopoverEffect.of({
				from: selection.from,
				to: selection.from + highlightText.length,
			}),
		],
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
