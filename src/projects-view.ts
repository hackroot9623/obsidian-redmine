import { ItemView, WorkspaceLeaf } from 'obsidian';
import { RedmineClient } from './redmine-client';
import { PROJECTS_VIEW_TYPE } from '../main';

export class ProjectsView extends ItemView {
    private redmineClient: RedmineClient;
    private projects: any[] = [];

    constructor(leaf: WorkspaceLeaf, redmineClient: RedmineClient) {
        super(leaf);
        this.redmineClient = redmineClient;
    }

    getViewType() {
        return PROJECTS_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Redmine Projects';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h2', { text: 'Redmine Projects' });

        this.loadProjects();
    }

    async loadProjects() {
        try {
            const response = await this.redmineClient.getProjects();
            this.projects = response.projects;
            this.renderProjects();
        } catch (e) {
            console.error('Error loading projects:', e);
            new Notice(`Error loading projects: ${e.message}`);
        }
    }

    renderProjects() {
        const container = this.containerEl.children[1];
        const projectListEl = container.querySelector('.project-list');
        if (projectListEl) {
            projectListEl.remove();
        }

        const projectList = container.createDiv({ cls: 'project-list' });

        if (this.projects.length === 0) {
            projectList.createEl('p', { text: 'No projects found.' });
            return;
        }

        this.projects.forEach(project => {
            const projectEl = projectList.createDiv({ cls: 'project-item' });
            projectEl.createEl('h4', { text: project.name });
            projectEl.createEl('p', { text: project.description });
        });
    }

    onClose() {
        // Nothing to clean up.
    }
}
