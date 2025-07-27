import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Menu } from 'obsidian';
import { RedmineClient } from './src/redmine-client';
import { CreateIssueModal } from './src/create-issue-modal';
import { IssueSelectionModal } from './src/issue-selection-modal';
import { IssuesView } from './src/issues-view';
import { ProjectsView } from './src/projects-view';
import { TaskListView } from './src/task-list-view';
import './styles.css';

export const TASK_LIST_VIEW_TYPE = 'redmine-task-list-view';
export const ISSUES_VIEW_TYPE = 'redmine-issues-view';
export const PROJECTS_VIEW_TYPE = 'redmine-projects-view';

// Remember to rename these classes and interfaces!

interface RedminePluginSettings {
	redmineUrl: string;
	redmineApiKey: string;
	userId: string;
	geminiApiKey: string;
	language: string;
	defaultView: string;
}

const DEFAULT_SETTINGS: RedminePluginSettings = {
	redmineUrl: '',
	redmineApiKey: '',
	userId: '',
	geminiApiKey: '',
	language: 'en',
	defaultView: ISSUES_VIEW_TYPE
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
			id: 'open-redmine-task-list-view',
			name: 'Open Redmine Task List View',
			callback: async () => {
				this.app.workspace.detachLeavesOfType(TASK_LIST_VIEW_TYPE);
				await this.app.workspace.getRightLeaf(false).setViewState({
				  type: TASK_LIST_VIEW_TYPE,
				  active: true,
				});
				this.app.workspace.revealLeaf(
				  this.app.workspace.getLeavesOfType(TASK_LIST_VIEW_TYPE)[0]
				);
			}
		});

		this.addCommand({
			id: 'open-redmine-projects-view',
			name: 'Open Redmine Projects View',
			callback: async () => {
				this.app.workspace.detachLeavesOfType(PROJECTS_VIEW_TYPE);
				await this.app.workspace.getRightLeaf(false).setViewState({
				  type: PROJECTS_VIEW_TYPE,
				  active: true,
				});
				this.app.workspace.revealLeaf(
				  this.app.workspace.getLeavesOfType(PROJECTS_VIEW_TYPE)[0]
				);
			}
		});

		this.addCommand({
			id: 'open-redmine-issues-view',
			name: 'Open Redmine Issues View',
			callback: () => {
				this.activateView();
			}
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

        this.addCommand({
            id: 'insert-redmine-issue',
            name: 'Insert Redmine Issue into note',
            callback: () => {
                new IssueSelectionModal(this.app, this.redmineClient, (issue) => {
                    const activeLeaf = this.app.workspace.activeLeaf;
                    if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
                        const editor = activeLeaf.view.editor;
                        const issueText = `## Redmine Issue: #${issue.id} - ${issue.subject}\n\n` +
                            `**Project:** ${issue.project.name}\n` +
                            `**Status:** ${issue.status.name}\n` +
                            `**Assigned To:** ${issue.assigned_to ? issue.assigned_to.name : 'N/A'}\n` +
                            `**Tracker:** ${issue.tracker.name}\n` +
                            `**Description:**\n${issue.description || 'No description provided.'}\n\n` +
                            `[View in Redmine](${this.settings.redmineUrl}/issues/${issue.id})`;
                        editor.replaceSelection(issueText);
                    }
                }).open();
            }
        });

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				menu.addItem((item) => {
					item.setTitle('Create Redmine Issue')
						.setIcon('bug')
						.onClick(() => {
							const selection = editor.getSelection();
							if (selection) {
								new CreateIssueModal(this.app, this.redmineClient, selection).open();
							}
						});
				});
			})
		);

	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(TASK_LIST_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(ISSUES_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(PROJECTS_VIEW_TYPE);

		await this.app.workspace.getRightLeaf(false).setViewState({
		  type: this.settings.defaultView,
		  active: true,
		});

		this.app.workspace.revealLeaf(
		  this.app.workspace.getLeavesOfType(this.settings.defaultView)[0]
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

import { ProjectSelectionModal } from './src/project-selection-modal';

class RedmineSettingTab extends PluginSettingTab {
	plugin: RedminePlugin;

	constructor(app: App, plugin: RedminePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		let redmineUrl = this.plugin.settings.redmineUrl;
		let redmineApiKey = this.plugin.settings.redmineApiKey;
		let userId = this.plugin.settings.userId;
		let geminiApiKey = this.plugin.settings.geminiApiKey;
		let language = this.plugin.settings.language;
		let defaultView = this.plugin.settings.defaultView;

		containerEl.createEl('h2', {text: 'Redmine Settings'});

		new Setting(containerEl)
			.setName('Redmine URL')
			.setDesc('The base URL of your Redmine instance (e.g., https://your-redmine.com).')
			.addText(text => text
				.setPlaceholder('https://redmine.example.com')
				.setValue(redmineUrl)
				.onChange(value => {
					redmineUrl = value;
				}));

		new Setting(containerEl)
			.setName('Redmine API Key')
			.setDesc('Your Redmine API access key. You can find this in your Redmine profile settings.')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(redmineApiKey)
				.onChange(value => {
					redmineApiKey = value;
				}));

		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('Test Connection')
				.onClick(async () => {
					const tempClient = new RedmineClient(redmineUrl, redmineApiKey);
					try {
						await tempClient.testConnection();
						new Notice('Connection successful!');
					} catch (e) {
						new Notice(`Connection failed: ${e.message}`);
					}
				}));

		new Setting(containerEl)
			.setName('Your Redmine User')
			.setDesc('Select your Redmine user from the dropdown. This is used for "Created by" field in new issues.')
			.addDropdown(async dropdown => {
				try {
					const users = await this.plugin.redmineClient.getUsers();
					for (const user of users.users) {
						dropdown.addOption(user.id, `${user.firstname} ${user.lastname} (${user.login})`);
					}
					dropdown.setValue(userId);
					dropdown.onChange(value => {
						userId = value;
					});
					dropdown.selectEl.addClass('wide-dropdown');
				} catch (e) {
					new Notice(`Failed to load Redmine users: ${e.message}`);
					console.error(e);
				}
			});

		containerEl.createEl('h2', {text: 'AI Settings'});

		new Setting(containerEl)
			.setName('Gemini API Key')
			.setDesc('Your Google Gemini API key. This is required for AI-powered description generation.')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(geminiApiKey)
				.onChange(value => {
					geminiApiKey = value;
				}));

		new Setting(containerEl)
			.setName('AI Description Language')
			.setDesc(`The language for AI-generated descriptions (e.g., 'en' for English, 'es' for Spanish, 'fr' for French).`)
			.addText(text => text
				.setPlaceholder('en')
				.setValue(language)
				.onChange(value => {
					language = value;
				}));

		new Setting(containerEl)
			.setName('Default View')
			.setDesc('Select the default view to open when clicking the ribbon icon.')
			.addDropdown(dropdown => {
				dropdown.addOption(ISSUES_VIEW_TYPE, 'Issues View');
				dropdown.addOption(TASK_LIST_VIEW_TYPE, 'Task List View');
				dropdown.setValue(defaultView);
				dropdown.onChange(value => {
					defaultView = value;
				});
			});

		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('Save Settings')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.redmineUrl = redmineUrl;
					this.plugin.settings.redmineApiKey = redmineApiKey;
					this.plugin.settings.userId = userId;
					this.plugin.settings.geminiApiKey = geminiApiKey;
					this.plugin.settings.language = language;
					this.plugin.settings.defaultView = defaultView;
					await this.plugin.saveSettings();
					this.plugin.redmineClient = new RedmineClient(this.plugin.settings.redmineUrl, this.plugin.settings.redmineApiKey);
					new Notice('Settings saved successfully!');
				}));
	}
}
