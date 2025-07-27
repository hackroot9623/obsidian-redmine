import { App, Modal, Setting } from 'obsidian';
import { RedmineClient } from './redmine-client';

export class IssueSelectionModal extends Modal {
    private redmineClient: RedmineClient;
    private onSelect: (issue: any) => void;
    private allIssues: any[] = []; // Stores all issues fetched from Redmine
    private filteredIssues: any[] = []; // Stores issues after client-side filtering
    private searchInput: HTMLInputElement;

    private projects: any[] = [];
    private selectedProjectId: string | null = null;
    private projectDropdown: any;

    private currentPage: number = 1;
    private itemsPerPage: number = 10; // Number of issues to display per page

    constructor(app: App, redmineClient: RedmineClient, onSelect: (issue: any) => void) {
        super(app);
        this.redmineClient = redmineClient;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Select Redmine Issue' });

        new Setting(contentEl)
            .setName('Filter Projects')
            .addText(text => {
                text.setPlaceholder('Enter project name');
                text.onChange(value => this.filterProjects(value));
            });

        new Setting(contentEl)
            .setName('Project')
            .addDropdown(dropdown => {
                dropdown.addOption('', 'All Projects');
                this.projectDropdown = dropdown;
                this.loadProjects();
                dropdown.onChange(value => {
                    this.selectedProjectId = value;
                    this.searchIssues(this.searchInput.value);
                });
            });

        new Setting(contentEl)
            .setName('Search Issue')
            .addText(text => {
                text.setPlaceholder('Enter issue subject or ID');
                text.onChange(value => this.searchIssues(value));
                this.searchInput = text.inputEl;
            });

        this.renderIssues();
    }

    async loadProjects() {
        try {
            const response = await this.redmineClient.getProjects();
            this.projects = response.projects;
            this.updateProjectDropdown();
        } catch (e) {
            console.error('Error loading projects:', e);
            new Notice(`Error loading projects: ${e.message}`);
        }
    }

    updateProjectDropdown() {
        this.projectDropdown.selectEl.innerHTML = '';
        this.projectDropdown.addOption('', 'All Projects');
        this.projects.forEach(project => {
            this.projectDropdown.addOption(project.id, project.name);
        });
        if (this.selectedProjectId) {
            this.projectDropdown.setValue(this.selectedProjectId);
        }
    }

    filterProjects(query: string) {
        this.projectDropdown.selectEl.innerHTML = '';
        this.projectDropdown.addOption('', 'All Projects');
        const filtered = this.projects.filter(project => project.name.toLowerCase().includes(query.toLowerCase()));
        filtered.forEach(project => {
            this.projectDropdown.addOption(project.id, project.name);
        });
        this.projectDropdown.setValue(''); // Reset selection when filtering
        this.selectedProjectId = null;
        this.searchIssues(this.searchInput.value);
    }

    async searchIssues(query: string) {
        const currentQuery = query.toLowerCase();

        // Fetch all issues assigned to the user and optionally filtered by project
        try {
            const response = await this.redmineClient.searchIssues('', this.selectedProjectId, 'me');
            this.allIssues = response.issues;
        } catch (e) {
            console.error('Error fetching all issues:', e);
            new Notice(`Error fetching all issues: ${e.message}`);
            this.allIssues = [];
        }

        // Client-side filtering
        this.filteredIssues = this.allIssues.filter(issue =>
            issue.subject.toLowerCase().includes(currentQuery) ||
            issue.id.toString().includes(currentQuery)
        );

        this.currentPage = 1; // Reset to first page on new search/filter
        this.renderIssues();
    }

    renderIssues() {
        const issueListEl = this.contentEl.querySelector('.issue-list');
        if (issueListEl) {
            issueListEl.remove();
        }

        const container = this.contentEl.createDiv({ cls: 'issue-list' });

        if (this.filteredIssues.length === 0) {
            container.createEl('p', { text: 'No issues found.' });
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const issuesToDisplay = this.filteredIssues.slice(startIndex, endIndex);

        issuesToDisplay.forEach(issue => {
            const issueEl = container.createDiv({ cls: 'issue-item' });
            issueEl.createEl('h4', { text: `#${issue.id}: ${issue.subject}` });
            issueEl.createEl('p', { text: `Project: ${issue.project.name}` });
            issueEl.createEl('p', { text: `Status: ${issue.status.name}` });
            issueEl.createEl('p', { text: `Assigned to: ${issue.assigned_to ? issue.assigned_to.name : 'N/A'}` });

            issueEl.addEventListener('click', () => {
                this.onSelect(issue);
                this.close();
            });
        });

        this.renderPaginationControls(container);
    }

    renderPaginationControls(container: HTMLElement) {
        const totalPages = Math.ceil(this.filteredIssues.length / this.itemsPerPage);

        if (totalPages <= 1) {
            return;
        }

        const paginationControls = container.createDiv({ cls: 'pagination-controls' });

        const prevButton = paginationControls.createEl('button', { text: 'Previous' });
        prevButton.disabled = this.currentPage === 1;
        prevButton.addEventListener('click', () => {
            this.currentPage--;
            this.renderIssues();
        });

        const pageInfo = paginationControls.createEl('span', { text: `Page ${this.currentPage} of ${totalPages}` });

        const nextButton = paginationControls.createEl('button', { text: 'Next' });
        nextButton.disabled = this.currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            this.currentPage++;
            this.renderIssues();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
