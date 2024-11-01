import { App, PluginSettingTab, Setting } from "obsidian";
import type OmnireaderPlugin from "./main";

export class OmnireaderSettingTab extends PluginSettingTab {
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
