import { App, Modal, Setting } from 'obsidian';
import { RedmineClient } from './redmine-client';

export class LogTimeModal extends Modal {
    private redmineClient: RedmineClient;
    private issueId: number;

    constructor(app: App, redmineClient: RedmineClient, issueId: number) {
        super(app);
        this.redmineClient = redmineClient;
        this.issueId = issueId;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: `Log Time for Issue #${this.issueId}` });

        let hours: string;

        new Setting(contentEl)
            .setName('Hours')
            .addText(text => text
                .setPlaceholder('e.g. 1.5')
                .onChange(value => hours = value));

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Log Time')
                .onClick(async () => {
                    try {
                        await this.redmineClient.logTime(this.issueId, hours);
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
