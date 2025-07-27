import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { RedmineClient } from './redmine-client';
import { ISSUES_VIEW_TYPE } from '../main';
import dragula from 'dragula';

export const KANBAN_VIEW_TYPE = 'redmine-kanban-view';

export class KanbanView extends ItemView {
    private redmineClient: RedmineClient;
    private issues: any[] = [];
    private statuses: any[] = [];
    private projects: any[] = [];
    private selectedProjectId: string;
    private drake: dragula.Drake;
    private intervalId: number;

    constructor(leaf: WorkspaceLeaf, redmineClient: RedmineClient) {
        super(leaf);
        this.redmineClient = redmineClient;
    }

    getViewType() {
        return KANBAN_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Redmine Kanban';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        const header = container.createDiv({ cls: 'kanban-header' });
        header.createEl('h2', { text: 'Redmine Kanban Board' });

        const projectSelector = header.createEl('select');
        projectSelector.addEventListener('change', (e) => {
            this.selectedProjectId = (e.target as HTMLSelectElement).value;
            this.refresh();
        });

        const refreshButton = header.createEl('button', { text: 'Refresh' });
        refreshButton.addEventListener('click', () => this.refresh());


        await this.loadProjects(projectSelector);
        await this.loadStatuses();
        await this.loadIssues();

        this.intervalId = window.setInterval(() => this.refresh(), 5 * 60 * 1000);
    }

    async loadStatuses() {
        try {
            const response = await this.redmineClient.getIssueStatuses();
            this.statuses = response.issue_statuses;
        } catch (e) {
            console.error('Error loading issue statuses:', e);
            new Notice(`Error loading issue statuses: ${e.message}`);
        }
    }

    async loadProjects(selector: HTMLSelectElement) {
        try {
            const response = await this.redmineClient.getProjects();
            this.projects = response.projects;
            this.projects.forEach(project => {
                const option = selector.createEl('option', { value: project.id, text: project.name });
            });
            if (this.projects.length > 0) {
                this.selectedProjectId = this.projects[0].id;
            }
        } catch (e) {
            console.error('Error loading projects:', e);
            new Notice(`Error loading projects: ${e.message}`);
        }
    }

    async loadIssues() {
        if (!this.selectedProjectId) {
            return;
        }
        try {
            const versionsResponse = await this.redmineClient.getProjectVersions(this.selectedProjectId);
            const activeSprint = versionsResponse.versions.find(v => v.status === 'open');
            if (activeSprint) {
                const response = await this.redmineClient.searchIssues('', this.selectedProjectId, undefined, activeSprint.id);
                this.issues = response.issues;
            } else {
                this.issues = [];
            }
            this.renderKanbanBoard();
        } catch (e) {
            console.error('Error loading issues:', e);
            new Notice(`Error loading issues: ${e.message}`);
        }
    }

    renderKanbanBoard() {
        const container = this.containerEl.children[1];
        let kanbanBoardEl = container.querySelector('.kanban-board');
        if (kanbanBoardEl) {
            kanbanBoardEl.remove();
        }

        const kanbanBoard = container.createDiv({ cls: 'kanban-board' });
        const columns = [];

        this.statuses.forEach(status => {
            const column = kanbanBoard.createDiv({ cls: 'kanban-column', attr: { 'data-status-id': status.id } });
            column.createEl('h3', { text: status.name });
            const issuesInColumn = this.issues.filter(issue => issue.status.id === status.id);
            issuesInColumn.forEach(issue => {
                const card = column.createDiv({ cls: 'kanban-card', attr: { 'data-issue-id': issue.id } });
                card.createEl('h4', { text: `#${issue.id}: ${issue.subject}` });
                card.createEl('p', { text: `Project: ${issue.project.name}` });
                card.createEl('p', { text: `Assigned to: ${issue.assigned_to ? issue.assigned_to.name : 'N/A'}` });
            });
            columns.push(column);
        });

        this.drake = dragula(columns);

        this.drake.on('drop', async (el, target, source, sibling) => {
            const issueId = Number(el.getAttribute('data-issue-id'));
            const statusId = Number(target.getAttribute('data-status-id'));

            try {
                const response = await this.redmineClient.getIssueAllowedStatuses(issueId);
                const allowedStatuses = response.issue.allowed_statuses;
                const isAllowed = allowedStatuses.some(status => status.id === statusId);

                if (isAllowed) {
                    await this.redmineClient.updateIssueStatus(issueId, statusId);
                    new Notice('Issue status updated successfully.');
                } else {
                    new Notice('Invalid status transition.', 'error');
                    source.appendChild(el);
                }
            } catch (e) {
                console.error('Error updating issue status:', e);
                new Notice(`Error updating issue status: ${e.message}`);
                source.appendChild(el);
            }
        });
    }

    async refresh() {
        await this.loadIssues();
    }

    onClose() {
        if (this.drake) {
            this.drake.destroy();
        }
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
        }
    }
}
