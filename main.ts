import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { RedmineClient } from './src/redmine-client';
import { TaskListView, TASK_LIST_VIEW_TYPE } from './src/task-list-view';
import { CreateIssueModal } from './src/create-issue-modal';
import './styles.css';

// Remember to rename these classes and interfaces!

interface RedminePluginSettings {
	redmineUrl: string;
	redmineApiKey: string;
	userId: string;
	geminiApiKey: string;
}

const DEFAULT_SETTINGS: RedminePluginSettings = {
	redmineUrl: '',
	redmineApiKey: '',
	userId: '',
	geminiApiKey: ''
}

export default class RedminePlugin extends Plugin {
	settings: RedminePluginSettings;
	redmineClient: RedmineClient;

	async onload() {
		await this.loadSettings();
		this.redmineClient = new RedmineClient(this.settings.redmineUrl, this.settings.redmineApiKey);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RedmineSettingTab(this.app, this));

		this.registerView(
			TASK_LIST_VIEW_TYPE,
			(leaf) => new TaskListView(leaf, this.app, this.redmineClient)
		);

		this.addRibbonIcon("dice", "Activate view", () => {
			this.activateView();
		  });

		this.addCommand({
			id: 'create-redmine-issue',
			name: 'Create Redmine Issue',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (selection) {
					new CreateIssueModal(this.app, this.redmineClient, selection).open();
				}
			}
		});

	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(TASK_LIST_VIEW_TYPE);

		await this.app.workspace.getRightLeaf(false).setViewState({
		  type: TASK_LIST_VIEW_TYPE,
		  active: true,
		});

		this.app.workspace.revealLeaf(
		  this.app.workspace.getLeavesOfType(TASK_LIST_VIEW_TYPE)[0]
		);
	  }

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class RedmineSettingTab extends PluginSettingTab {
	plugin: RedminePlugin;

	constructor(app: App, plugin: RedminePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Redmine URL')
			.setDesc('The URL of your Redmine instance.')
			.addText(text => text
				.setPlaceholder('https://redmine.example.com')
				.setValue(this.plugin.settings.redmineUrl)
				.onChange(async (value) => {
					this.plugin.settings.redmineUrl = value;
					await this.plugin.saveSettings();
					this.plugin.redmineClient = new RedmineClient(this.plugin.settings.redmineUrl, this.plugin.settings.redmineApiKey);
				}));

		new Setting(containerEl)
			.setName('Redmine API Key')
			.setDesc('Your Redmine API key.')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.redmineApiKey)
				.onChange(async (value) => {
					this.plugin.settings.redmineApiKey = value;
					await this.plugin.saveSettings();
					this.plugin.redmineClient = new RedmineClient(this.plugin.settings.redmineUrl, this.plugin.settings.redmineApiKey);
				}));

		new Setting(containerEl)
			.setName('Your Redmine User')
			.setDesc('Select your Redmine user.')
			.addDropdown(async dropdown => {
				try {
					const users = await this.plugin.redmineClient.getUsers();
					for (const user of users.users) {
						dropdown.addOption(user.id, user.name);
					}
					dropdown.setValue(this.plugin.settings.userId);
					dropdown.onChange(async (value) => {
						this.plugin.settings.userId = value;
						await this.plugin.saveSettings();
					});
					dropdown.selectEl.addClass('wide-dropdown');
				} catch (e) {
					console.error(e);
				}
			});

		new Setting(containerEl)
			.setName('Gemini API Key')
			.setDesc('Your Google Gemini API key.')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.geminiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.geminiApiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}
