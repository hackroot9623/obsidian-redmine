import { ItemView, WorkspaceLeaf } from 'obsidian';
import { RedmineClient } from './redmine-client';
import { ISSUES_VIEW_TYPE } from '../main';

export class IssuesView extends ItemView {
    private redmineClient: RedmineClient;
    private issues: any[] = [];

    constructor(leaf: WorkspaceLeaf, redmineClient: RedmineClient) {
        super(leaf);
        this.redmineClient = redmineClient;
    }

    getViewType() {
        return ISSUES_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Redmine Issues';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h2', { text: 'Redmine Issues' });

        this.loadIssues();
    }

    async loadIssues() {
        try {
            const response = await this.redmineClient.getIssues('me');
            this.issues = response.issues;
            this.renderIssues();
        } catch (e) {
            console.error('Error loading issues:', e);
            new Notice(`Error loading issues: ${e.message}`);
        }
    }

    renderIssues() {
        const container = this.containerEl.children[1];
        const issueListEl = container.querySelector('.issue-list');
        if (issueListEl) {
            issueListEl.remove();
        }

        const issueList = container.createDiv({ cls: 'issue-list' });

        if (this.issues.length === 0) {
            issueList.createEl('p', { text: 'No issues found.' });
            return;
        }

        this.issues.forEach(issue => {
            const issueEl = issueList.createDiv({ cls: 'issue-item' });
            issueEl.createEl('h4', { text: `#${issue.id}: ${issue.subject}` });
            issueEl.createEl('p', { text: `Project: ${issue.project.name}` });
            issueEl.createEl('p', { text: `Status: ${issue.status.name}` });
            issueEl.createEl('p', { text: `Assigned to: ${issue.assigned_to ? issue.assigned_to.name : 'N/A'}` });
        });
    }

    onClose() {
        // Nothing to clean up.
    }
}
