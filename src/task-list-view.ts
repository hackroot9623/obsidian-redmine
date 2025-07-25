import { ItemView, WorkspaceLeaf, App } from 'obsidian';
import { RedmineClient } from './redmine-client';
import { LogTimeModal } from './log-time-modal';

export const TASK_LIST_VIEW_TYPE = 'redmine-task-list-view';

export class TaskListView extends ItemView {
    private redmineClient: RedmineClient;
    private app: App;

    constructor(leaf: WorkspaceLeaf, app: App, redmineClient: RedmineClient) {
        super(leaf);
        this.app = app;
        this.redmineClient = redmineClient;
    }

    getViewType() {
        return TASK_LIST_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Redmine Tasks';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h2', { text: 'Redmine Tasks' });

        const searchInput = container.createEl('input', {
            type: 'text',
            placeholder: 'Search issues...'
        });

        const issuesContainer = container.createDiv();
        const issues = await this.renderIssues(issuesContainer);

        searchInput.on('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const filteredIssues = issues.issues.filter((issue: any) =>
                issue.subject.toLowerCase().includes(searchTerm)
            );
            this.renderIssues(issuesContainer, { issues: filteredIssues });
        });
    }

    async renderIssues(container: HTMLElement, issues: any = null) {
        container.empty();
        try {
            if (!issues) {
                // @ts-ignore
                const userId = this.app.plugins.plugins['obsidian-redmine-integration'].settings.userId;
                issues = await this.redmineClient.getIssues(userId);
            }

            for (const issue of issues.issues) {
                const issueEl = container.createDiv();
                issueEl.createEl('a', { text: issue.subject, href: `${this.redmineClient.redmineUrl}/issues/${issue.id}` });
                issueEl.createEl('span', { text: ` #${issue.id}` });
                issueEl.createEl('span', { text: ` (${issue.tracker.name})` });
                issueEl.createEl('span', { text: ` - ${issue.status.name}` });
                const logTimeButton = issueEl.createEl('button', { text: 'Log time' });
                logTimeButton.onClickEvent(() => {
                    new LogTimeModal(this.app, this.redmineClient, issue.id).open();
                });
            }
            return issues;
        } catch (e) {
            container.createEl('p', { text: 'Error fetching issues from Redmine.' });
            console.error(e);
        }
    }

    async onClose() {
        // Nothing to clean up.
    }
}
