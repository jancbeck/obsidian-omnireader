import { MarkdownView, Notice, Plugin } from "obsidian";

import {
	highlightExtension,
	cleanup as cleanupPopover,
} from "./editor/extension";
import { OmnireaderSettingTab } from "@/settings";
import { createHighlightCommand } from "@/editor/commands";
import postprocessor from "@/preview/postprocessor";
import allColorNames from "./colors";

type OmnireaderSettings = {
	expandSelection: boolean;
	colors: (typeof allColorNames)[number]["name"][];
};

const DEFAULT_SETTINGS: OmnireaderSettings = {
	expandSelection: true,
	colors: ["moccasin", "lavender", "palegreen", "lightpink"],
};

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
						createHighlightCommand(markdownView, this);
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

			createHighlightCommand(view, this);
		});

		this.registerMarkdownPostProcessor(postprocessor);
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
