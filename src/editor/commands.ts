import { Editor, Notice } from "obsidian";
import { openPopover } from "./extension";
import type OmnireaderPlugin from "@";

export function createHighlightCommand(
	editor: Editor,
	plugin: OmnireaderPlugin
) {
	let selectedText = editor.getSelection();

	if (!selectedText) {
		new Notice(`No text selected`);
		return false;
	}

	const sameLine =
		editor.getCursor("from").line === editor.getCursor("to").line;

	if (!sameLine) {
		new Notice(`Only same line highlights are supported. Sorry!`);
		return false;
	}

	const selectionContainsHighlight = selectedText.includes("==");

	if (selectionContainsHighlight) {
		new Notice(`Selection already contains a highlight`);
		return false;
	}

	if (plugin.settings.expandSelection) {
		selectedText = expandSelectionBoundary(editor);
	}

	const annotationText = `==${selectedText}==`;

	editor.replaceSelection(annotationText);
	editor.blur();
	openPopover();
}

function expandSelectionBoundary(editor: Editor) {
	const from = editor.getCursor("from");
	const to = editor.getCursor("to");
	const lineFrom = editor.getLine(from.line);
	const lineTo = editor.getLine(to.line);
	let start = from.ch;
	let end = to.ch;
	while (
		start > 0 &&
		lineFrom[start - 1].match(/\w/) &&
		lineFrom.substring(start - 2, start) !== "=="
	) {
		start--;
	}
	while (
		end < lineTo.length &&
		lineTo[end].match(/\w/) &&
		lineTo.substring(end, end + 2) !== "=="
	) {
		end++;
	}
	editor.setSelection(
		{ line: from.line, ch: start },
		{ line: to.line, ch: end }
	);
	return editor.getSelection();
}
