import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { AnnotateModal } from "./AnnotateModal";
import allColorNames from "./colors";

const DEFAULT_SETTINGS = {
	expandSelection: true,
	colors: "lightsalmon, lavender, palegreen, gold, lightpink, powderblue, wheat",
};
type OmnireaderSettings = typeof DEFAULT_SETTINGS;

export default class OmnireaderPlugin extends Plugin {
	settings: OmnireaderSettings;
	modalOpen = false;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Sample Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("This is a notice!");
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				// new AnnotateModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						// new AnnotateModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new OmnireaderSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "mouseup", async (e: MouseEvent) => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);

			const editor = view?.editor;
			let selection = editor?.getSelection();

			// if (view?.getMode() == "preview") {
			// }
			const target = e.target as HTMLElement | null;

			// when existing highlight is clicked open modal with existing content & color
			if (target?.hasClass("cm-highlight") && editor) {
				// wait for the cursor to be placed inside the highlight
				await new Promise((resolve) => setTimeout(resolve, 10));

				// move cursor to end of highlight
				moveCursorToNextString(editor, "==");

				let footnoteText = "";
				let higlightColor = "";

				// check if inline footnote already exists
				const footnote = matchInlineFootnote(editor);
				// accept all color names as valid color options
				const colorOptions = allColorNames.map((color) =>
					color.name.toLowerCase()
				);

				// select footnote content
				if (footnote) {
					footnoteText = footnote.content;
					editor.setSelection(footnote.from, footnote.to);
					const matchedColors = Array.from(
						footnoteText.matchAll(/@(\w+)/g)
					);

					if (matchedColors.length > 0) {
						// find first matched color that is in colorOptions
						higlightColor =
							Array.from(matchedColors).find(([_, color]) =>
								colorOptions.includes(color)
							)?.[1] || "";

						footnoteText = footnoteText.replace(
							new RegExp(` ?@${higlightColor}`, "g"),
							""
						);
					}
				}
				openAnnotateModal(footnoteText, higlightColor);
			}

			if (!selection || !editor?.hasFocus()) {
				return;
			}

			if (this.settings.expandSelection) {
				expandSelectionBoundary(editor);
			}
			selection = editor?.getSelection();
			// apply built-in highlight command which handles edge cases
			(
				this.app as App & {
					commands: { executeCommandById: (cmd: string) => void };
				}
			).commands.executeCommandById("editor:toggle-highlight");

			// move cursor to end of highlight
			moveCursorToNextString(editor, "==");

			openAnnotateModal();
		});

		function matchInlineFootnote(editor: Editor) {
			const cursor = editor.getCursor();
			const line = editor.getLine(cursor.line);
			const textAfterCursor = line.substring(cursor.ch);

			// Match pattern ^[...] with any content inside brackets
			const footnoteMatch = textAfterCursor
				.trimStart()
				.match(/^\^\[((?:[^[\]]|\[(?:[^[\]]|\[[^[\]]*\])*\])*)\]/);

			if (footnoteMatch) {
				const whitespaceBeforeFootnote =
					textAfterCursor.length - textAfterCursor.trimStart().length;
				const matchStart = cursor.ch + whitespaceBeforeFootnote;
				const matchEnd = matchStart + footnoteMatch[0].length;

				return {
					from: { line: cursor.line, ch: matchStart },
					to: { line: cursor.line, ch: matchEnd },
					content: footnoteMatch[1], // Group 1 contains just the content inside brackets
				};
			}

			return null;
		}

		function moveCursorToNextString(editor: Editor, searchString: string) {
			const cursor = editor.getCursor();
			const lastLine = editor.lastLine();
			const currentLine = cursor.line;
			const currentCh = cursor.ch;

			// Search through current line first
			const line = editor.getLine(currentLine);
			const indexInCurrentLine = line.indexOf(searchString, currentCh);

			if (indexInCurrentLine !== -1) {
				// Found == in current line
				editor.setCursor({
					line: currentLine,
					ch: indexInCurrentLine + 2,
				});
				return true;
			}

			// Search through subsequent lines
			for (
				let searchLine = currentLine + 1;
				searchLine <= lastLine;
				searchLine++
			) {
				const line = editor.getLine(searchLine);
				const index = line.indexOf(searchString);

				if (index !== -1) {
					// Found == in this line
					editor.setCursor({ line: searchLine, ch: index + 2 });
					return true;
				}
			}

			// No == found
			return false;
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
		}

		const openAnnotateModal = (annotation = "", higlightColor = "") => {
			if (!this.modalOpen) {
				this.modalOpen = true;
				const modal = new AnnotateModal(
					this.app,
					(result) => {
						const editor =
							this.app.workspace.getActiveViewOfType(
								MarkdownView
							)?.editor;
						editor?.blur(); // TODO: does nothing
						if (!result || !editor) {
							return;
						}

						editor.replaceSelection(`^[${result}]`);
						//editor.replaceRange(`^[${result}]`, editor.getCursor());

						// need to rerender preview to update highlights I think?
						this.app.workspace
							.getActiveViewOfType(MarkdownView)
							?.previewMode.rerender(true);
					},
					this.settings.colors
						.split(",")
						.map((color) => color.trim()),
					annotation,
					higlightColor
				);
				modal.open();
				modal.onClose = async () => {
					this.modalOpen = false;

					const editor =
						this.app.workspace.getActiveViewOfType(
							MarkdownView
						)?.editor;

					// wait until footnote content has been updated
					await new Promise((resolve) => setTimeout(resolve, 10));
					// editor?.blur() does nothing so instead we move the cursor forward
					// to avoid showing the raw markdown in live preview
					editor?.setCursor({
						line: editor.getCursor().line,
						ch: editor.getCursor().ch + 1,
					});
				};
			}
		};

		this.registerMarkdownPostProcessor((element, ctx) => {
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

	onunload() {}

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

class OmnireaderSettingTab extends PluginSettingTab {
	plugin: OmnireaderPlugin;

	constructor(app: App, plugin: OmnireaderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Expand Selection")
			.setDesc("Expand the selection boundary to the word")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.expandSelection)
					.onChange(async (value) => {
						this.plugin.settings.expandSelection = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Highlighting color options")
			.setDesc(
				document
					.createRange()
					.createContextualFragment(
						"Add comma separated list of <a href='https://developer.mozilla.org/en-US/docs/Web/CSS/named-color'>color names</a>"
					)
			)
			.setClass("[&_textarea]:w-full")
			.addTextArea((toggle) =>
				toggle
					.setValue(this.plugin.settings.colors)
					.onChange(async (value) => {
						this.plugin.settings.colors = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
