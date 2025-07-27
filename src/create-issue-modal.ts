import { App, Modal, Setting } from 'obsidian';
import { RedmineClient } from './redmine-client';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { ProjectSelectionModal } from './project-selection-modal';

export class CreateIssueModal extends Modal {
    private redmineClient: RedmineClient;
    private subject: string;
    private descriptionTextArea: any;
    private description: string;
    private selectedProjectId: string;
    private selectedProjectName: string = 'None';
    private assigneeDropdown: Setting;
    private assigneeId: string;
    private logTimeValue: string;

    constructor(app: App, redmineClient: RedmineClient, subject: string) {
        super(app);
        this.redmineClient = redmineClient;
        this.subject = subject;
        this.description = subject; // Initialize description with subject
        this.modalEl.addClass('redmine-create-issue-modal');
        this.assigneeId = ''; // Initialize assigneeId
    }

    private async updateAssigneeDropdown(currentAssigneeId: string) {
        if (!this.selectedProjectId) {
            return; // No project selected, so no assignees to load
        }

        try {
            const membershipsResponse = await this.redmineClient.getProjectMemberships(this.selectedProjectId);
            console.log('Memberships total_count:', membershipsResponse.total_count);
            console.log('Memberships retrieved:', membershipsResponse.memberships.length);

            const allUsersResponse = await this.redmineClient.getUsers();
            console.log('All users retrieved:', allUsersResponse.users.length);
            console.log('All user IDs:', allUsersResponse.users.map((u: any) => u.id));

            const users = membershipsResponse.memberships
                .map((m: any) => {
                    if (m.user && m.user.id) {
                        const foundUser = allUsersResponse.users.find((u: any) => u.id === m.user.id);
                        console.log(`Membership user ID: ${m.user.id}, Found user: ${foundUser ? foundUser.id : 'None'}`);
                        return foundUser;
                    }
                    console.log('Membership without user or user ID:', m);
                    return null; // Return null for non-user memberships or invalid user data
                })
                .filter((u: any) => u); // Filter out nulls

            console.log('Users after filtering:', users.length);

            this.assigneeDropdown.clear();
            this.assigneeDropdown.addDropdown(dropdown => {
                for (const user of users) {
                    dropdown.addOption(user.id, `${user.firstname} ${user.lastname} (${user.login})`);
                }
                dropdown.setValue(currentAssigneeId);
                dropdown.onChange(value => {
                    this.assigneeId = value;
                });
                dropdown.selectEl.addClass('wide-dropdown');
            });
        } catch (e) {
            new Notice(`Failed to load project members: ${e.message}`);
            console.error(e);
        }
    }

    async generateDescription() {
        // @ts-ignore
        const geminiApiKey = this.app.plugins.plugins['obsidian-redmine-integration'].settings.geminiApiKey;
        // @ts-ignore
        const language = this.app.plugins.plugins['obsidian-redmine-integration'].settings.language || 'en';
        if (!geminiApiKey) {
            console.error('Gemini API key is not set.');
            return;
        }

        try {
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            let prompt = `Based on the issue summary "${this.subject}", write a professional and technical description for a new issue in ${language}.`;

            const currentDescription = this.descriptionTextArea.getValue();
            if (currentDescription) {
                prompt += `\n\nConsider the following existing description for additional context: "${currentDescription}"`;
            }

            const result = await model.generateContent(prompt);
            const generatedText = result.response.text();
            this.descriptionTextArea.setValue(generatedText);
            this.description = generatedText; // Explicitly update the class property
        } catch (e) {
            new Notice(e.message);
            console.error(e);
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Create Redmine Issue' });

        let parentIssue: string;
        let trackerId: string;
        let estimatedTime: string;

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

        const projectSetting = new Setting(contentEl)
            .setName('Project')
            .setDesc('No project selected.')
            .addButton(button => button
                .setButtonText('Select Project')
                .onClick(async () => {
                    try {
                        const projects = await this.redmineClient.getProjects();
                        new ProjectSelectionModal(this.app, projects.projects, (selectedProjectId) => {
                            this.selectedProjectId = selectedProjectId;
                            const selectedProject = projects.projects.find((p: any) => p.id === selectedProjectId);
                            this.selectedProjectName = selectedProject ? selectedProject.name : 'None';
                            projectSetting.setDesc(`Selected: ${this.selectedProjectName}`);
                            // Now, update the assignee dropdown based on the selected project
                            this.updateAssigneeDropdown(this.assigneeId);
                        }).open();
                    } catch (e) {
                        new Notice(e.message);
                    }
                }));

        new Setting(contentEl)
            .setName('Tracker')
            .addDropdown(async dropdown => {
                try {
                    const trackers = await this.redmineClient.getTrackers();
                    for (const tracker of trackers.trackers) {
                        dropdown.addOption(tracker.id, tracker.name);
                    }
                    trackerId = dropdown.getValue();
                    dropdown.onChange(value => trackerId = value);
                    dropdown.selectEl.addClass('wide-dropdown');
                } catch (e) {
                    new Notice(e.message);
                    console.error(e);
                }
            });

        new Setting(contentEl)
            .setName('Description')
            .addTextArea(text => {
                this.descriptionTextArea = text;
                text.setValue(this.description); // Set initial value
                text.onChange(value => this.description = value);
                text.inputEl.addClass('large-textarea');
            });

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Generate description')
                .onClick(async () => {
                    await this.generateDescription();
                }));

        this.assigneeDropdown = new Setting(contentEl)
            .setName('Assignee');

        // Initial load of assignees (if a project is already selected, e.g., from a previous session)
        this.updateAssigneeDropdown(this.assigneeId);

        new Setting(contentEl)
            .setName('Parent issue')
            .addText(text => text
                .setPlaceholder('e.g. 123')
                .onChange(value => parentIssue = value));

        new Setting(contentEl)
            .setName('Estimated time')
            .setDesc('Estimated time for the issue (e.g., 1.5 for 1 hour 30 minutes).')
            .addText(text => text
                .setPlaceholder('e.g. 1.5')
                .onChange(value => estimatedTime = value));

        new Setting(contentEl)
            .setName('Log time')
            .setDesc('Time to log for this issue (e.g., 0.5 for 30 minutes).')
            .addText(text => text
                .setPlaceholder('e.g. 0.5')
                .onChange(value => this.logTimeValue = value));


        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Create')
                .onClick(async () => {
                    try {
                        if (!this.selectedProjectId) {
                            new Notice('Please select a project.');
                            return;
                        }
                        const issue: any = {
                            subject: this.subject,
                            project_id: this.selectedProjectId,
                            assigned_to_id: this.assigneeId,
                            tracker_id: trackerId,
                            description: this.description,
                        };
                        if (estimatedTime) {
                            issue.estimated_hours = estimatedTime;
                        }
                        if (parentIssue) {
                            issue.parent_issue_id = parentIssue;
                        }
                        const createdIssue = await this.redmineClient.createIssue(issue);
                        if (this.logTimeValue) {
                            await this.redmineClient.logTime(createdIssue.issue.id, this.logTimeValue);
                        }
                        this.close();
                    } catch (e) {
                        new Notice(e.message);
                        console.error(e);
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
