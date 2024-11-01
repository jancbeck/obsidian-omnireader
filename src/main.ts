import { MarkdownView, Notice, Plugin } from "obsidian";

import {
	highlightExtension,
	cleanup as cleanupPopover,
} from "./editor/extension";
import { OmnireaderSettingTab } from "./settings";
import { createHighlightCommand } from "./editor/commands";

const DEFAULT_SETTINGS = {
	expandSelection: true,
	colors: "lightsalmon, lavender, palegreen, gold, lightpink, powderblue, wheat",
};
type OmnireaderSettings = typeof DEFAULT_SETTINGS;

export default class OmnireaderPlugin extends Plugin {
	settings: OmnireaderSettings;
	isModalOpen = false;
	isAnnotateModeOn = false;
	statusBarItemEl: HTMLElement;

	async onload() {
		await this.loadSettings();

		// Icon in the left ribbon to toggle annotation mode
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			`${this.isAnnotateModeOn ? "Disable" : "Enable"} Annotation Mode`,
			() => {
				this.toggleAnnotateMode();
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		this.statusBarItemEl = this.addStatusBarItem();
		this.statusBarItemEl.setText(`Annotate Mode: ${this.isAnnotateModeOn}`);
		this.statusBarItemEl.addEventListener("click", () =>
			this.toggleAnnotateMode()
		);

		// Add the annotation extension to CodeMirror
		this.registerEditorExtension(highlightExtension());

		// Add a command to create annotations
		this.addCommand({
			id: "create-annotation",
			name: "Create Highlight",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				const selectedText = markdownView?.editor.getSelection();
				if (markdownView && selectedText) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						createHighlightCommand(markdownView.editor);
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new OmnireaderSettingTab(this.app, this));

		// highlight selected text when in annotate mode
		this.registerDomEvent(document, "mouseup", async (e: MouseEvent) => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);

			const editor = view?.editor;
			const selectionText = editor?.getSelection();

			if (!editor || !selectionText) return;

			// require modifier key when not in annotate mode
			if (!e.metaKey && !this.isAnnotateModeOn) return;

			createHighlightCommand(editor);
		});

		this.registerMarkdownPostProcessor((element, ctx) => {
			const marks = element.findAll("mark");
			for (const mark of marks) {
				console.log(mark.nextElementSibling, ctx.getSectionInfo(mark));
			}

			return;
			const references = element.findAll("mark + sup.footnote-ref");
			// turn higlights into footnote references
			for (const ref of references) {
				let refAnchor = ref.children[0] as HTMLElement | null;
				const highlight =
					ref.previousElementSibling as HTMLElement | null;

				if (!highlight || !refAnchor) continue;

				refAnchor.innerHTML = highlight.innerText;
				highlight.innerHTML = refAnchor.outerHTML;
				ref.remove();

				refAnchor = highlight.children[0] as HTMLElement | null;
				if (!refAnchor) continue;
				refAnchor?.style.setProperty("color", "var(--text-normal)");

				this.registerDomEvent(refAnchor, "click", (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();

					const popover = element.ownerDocument.body.find(
						".hover-popover [data-type=footnote]"
					);

					const clickEvent = new MouseEvent("click", {
						bubbles: true,
						cancelable: true,
						view: window,
					});
					popover?.dispatchEvent(clickEvent);
				});
			}

			const footnotes = element.findAll("section.footnotes > ol > li");
			// style highlights based on footnote color
			for (const footnote of footnotes) {
				const footnoteRefHref = footnote.getAttribute("id");
				const ref = element.ownerDocument.body.find(
					".footnote-link[href='#" + footnoteRefHref + "']"
				);
				const mark = ref?.parentElement;
				const footnoteText = footnote.innerText;
				const color = footnoteText.match(/@(\w+)/)?.[1];

				if (!color || !mark) return;

				mark.style.setProperty("--text-highlight-bg", color);
				mark.addClass("omnireader-higlight");
				footnote.innerText = footnote.innerText.replace(/@(\w+)/, "");
			}
		});
	}

	toggleAnnotateMode() {
		this.isAnnotateModeOn = !this.isAnnotateModeOn;
		this.statusBarItemEl.setText(`Annotate Mode: ${this.isAnnotateModeOn}`);
		new Notice(
			`Annotation Mode ${this.isAnnotateModeOn ? "Enabled" : "Disabled"}`
		);
	}

	onunload() {
		cleanupPopover();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
