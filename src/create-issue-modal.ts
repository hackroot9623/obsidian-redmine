import { App, Modal, Setting } from 'obsidian';
import { RedmineClient } from './redmine-client';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class CreateIssueModal extends Modal {
    private redmineClient: RedmineClient;
    private subject: string;
    private descriptionTextArea: any;

    constructor(app: App, redmineClient: RedmineClient, subject: string) {
        super(app);
        this.redmineClient = redmineClient;
        this.subject = subject;
    }

    async generateDescription() {
        // @ts-ignore
        const geminiApiKey = this.app.plugins.plugins['obsidian-redmine-integration'].settings.geminiApiKey;
        if (!geminiApiKey) {
            console.error('Gemini API key is not set.');
            return;
        }

        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Based on the issue summary "${this.subject}", write a professional and technical description for a new issue.`;

        const result = await model.generateContent(prompt);
        this.descriptionTextArea.setValue(result.response.text());
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Create Redmine Issue' });

        let projectId: string;
        let estimatedTime: string;
        let parentIssue: string;
        let assigneeId: string;

        new Setting(contentEl)
            .setName('Subject')
            .addText(text => text
                .setValue(this.subject)
                .setDisabled(true));

        new Setting(contentEl)
            .setName('Created by')
            .addText(text => {
                // @ts-ignore
                const userId = this.app.plugins.plugins['obsidian-redmine-integration'].settings.userId;
                this.redmineClient.getUsers().then(users => {
                    const user = users.users.find((u: any) => u.id == userId);
                    if (user) {
                        text.setValue(user.name);
                    }
                });
                text.setDisabled(true)
            });

        new Setting(contentEl)
            .setName('Estimated time')
            .addText(text => text
                .setPlaceholder('e.g. 1.5')
                .onChange(value => estimatedTime = value));

        new Setting(contentEl)
            .setName('Project')
            .addDropdown(async dropdown => {
                try {
                    const projects = await this.redmineClient.getProjects();
                    for (const project of projects.projects) {
                        dropdown.addOption(project.id, project.name);
                    }
                    projectId = dropdown.getValue();
                    dropdown.onChange(value => projectId = value);
                    dropdown.selectEl.addClass('wide-dropdown');
                } catch (e) {
                    console.error(e);
                }
            });

        new Setting(contentEl)
            .setName('Parent issue')
            .addText(text => text
                .setPlaceholder('e.g. 123')
                .onChange(value => parentIssue = value));

        new Setting(contentEl)
            .setName('Assignee')
            .addDropdown(async dropdown => {
                try {
                    const users = await this.redmineClient.getUsers();
                    for (const user of users.users) {
                        dropdown.addOption(user.id, user.name);
                    }
                    assigneeId = dropdown.getValue();
                    dropdown.onChange(value => assigneeId = value);
                    dropdown.selectEl.addClass('wide-dropdown');
                } catch (e) {
                    console.error(e);
                }
            });

        let description: string;

        new Setting(contentEl)
            .setName('Description')
            .addTextArea(text => {
                this.descriptionTextArea = text;
                text.onChange(value => description = value);
                text.inputEl.addClass('large-textarea');
            });

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Generate description')
                .onClick(async () => {
                    await this.generateDescription();
                }));


        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Create')
                .onClick(async () => {
                    try {
                        const issue: any = {
                            subject: this.subject,
                            project_id: projectId,
                            assigned_to_id: assigneeId,
                            description: description,
                        };
                        if (estimatedTime) {
                            issue.estimated_hours = estimatedTime;
                        }
                        if (parentIssue) {
                            issue.parent_issue_id = parentIssue;
                        }
                        await this.redmineClient.createIssue(issue);
                        this.close();
                    } catch (e) {
                        console.error(e);
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
