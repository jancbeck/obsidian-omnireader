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

// Custom interface for annotation position and content
interface AnnotationMatch {
	from: number;
	to: number;
	highlightText: string;
	comment: string;
	fullMatch: string;
}

class AnnotationWidget extends WidgetType {
	constructor(
		private highlightText: string,
		private comment: string,
		private from: number, // Store position information
		private to: number
	) {
		super();
	}

	eq(other: AnnotationWidget) {
		return (
			this.highlightText === other.highlightText &&
			this.comment === other.comment &&
			this.from === other.from &&
			this.to === other.to
		);
	}

	toDOM(view: EditorView) {
		const wrapper = document.createElement("span");
		wrapper.className = "obsidian-annotation";
		wrapper.textContent = this.highlightText;

		// Store positions as data attributes
		wrapper.setAttribute("data-from", String(this.from));
		wrapper.setAttribute("data-to", String(this.to));
		wrapper.setAttribute("data-comment", this.comment);

		wrapper.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.openAnnotationDialog(view);
		});

		return wrapper;
	}

	private openAnnotationDialog(view: EditorView) {
		const newComment = prompt("Edit annotation comment:", this.comment);

		if (newComment !== null) {
			const newAnnotationText = `==${this.highlightText}==<!--${newComment}-->`;

			// Use stored positions for accurate replacement
			const transaction = view.state.update({
				changes: {
					from: this.from,
					to: this.to,
					insert: newAnnotationText,
				},
			});
			view.dispatch(transaction);
		}
	}
}

// Helper function to find all annotations with their exact positions
function findAnnotations(doc: Text): AnnotationMatch[] {
	const annotations: AnnotationMatch[] = [];
	const regex = /==([^=]+)==<!--([^>]*)-->/g;

	// Iterate through each line of the document
	for (let i = 1; i <= doc.lines; i++) {
		const line = doc.line(i);
		const lineText = line.text;

		let match;
		regex.lastIndex = 0; // Reset regex for each line

		while ((match = regex.exec(lineText)) !== null) {
			const from = line.from + match.index;
			const to = from + match[0].length;

			annotations.push({
				from,
				to,
				highlightText: match[1],
				comment: match[2],
				fullMatch: match[0],
			});
		}
	}

	return annotations;
}

function createAnnotationDecorations(state: EditorState): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const annotations = findAnnotations(state.doc);

	for (const annotation of annotations) {
		const deco = Decoration.replace({
			widget: new AnnotationWidget(
				annotation.highlightText,
				annotation.comment,
				annotation.from,
				annotation.to
			),
		}).range(annotation.from, annotation.to);

		decorations.push(deco);
	}

	return Decoration.set(decorations, true); // 'true' for handling overlaps
}

export function annotationExtension(): Extension {
	const annotationField = StateField.define<DecorationSet>({
		create(state) {
			return createAnnotationDecorations(state);
		},
		update(decorations, transaction) {
			if (transaction.docChanged) {
				return createAnnotationDecorations(transaction.state);
			}
			return decorations.map(transaction.changes);
		},
		provide: (f) => EditorView.decorations.from(f),
	});

	return [
		annotationField,
		EditorView.baseTheme({
			".obsidian-annotation": {
				backgroundColor: "rgba(255, 255, 0, 0.3)",
				cursor: "pointer",
				borderRadius: "3px",
				padding: "0 2px",
			},
		}),
	];
}
