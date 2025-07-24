import { App, Modal, Setting } from 'obsidian';
import { RedmineClient } from './redmine-client';

export class CreateIssueModal extends Modal {
    private redmineClient: RedmineClient;
    private subject: string;

    constructor(app: App, redmineClient: RedmineClient, subject: string) {
        super(app);
        this.redmineClient = redmineClient;
        this.subject = subject;
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
                } catch (e) {
                    console.error(e);
                }
            });

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Create')
                .onClick(async () => {
                    try {
                        const issue: any = {
                            subject: this.subject,
                            project_id: projectId,
                            assigned_to_id: assigneeId,
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
