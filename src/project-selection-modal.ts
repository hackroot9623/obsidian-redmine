import { App, Modal, Setting } from 'obsidian';

export class ProjectSelectionModal extends Modal {
    private projects: any[];
    private onSelect: (projectId: string) => void;

    constructor(app: App, projects: any[], onSelect: (projectId: string) => void) {
        super(app);
        this.projects = projects;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Select Project' });

        const searchInput = new Setting(contentEl)
            .setName('Search')
            .addText(text => text
                .onChange(value => this.renderProjects(value.toLowerCase())));

        this.renderProjects();
    }

    renderProjects(filter: string = '') {
        const projectListEl = this.contentEl.querySelector('.project-list');
        if (projectListEl) {
            projectListEl.remove();
        }

        const container = this.contentEl.createDiv({ cls: 'project-list' });

        this.projects
            .filter(p => p.name.toLowerCase().includes(filter))
            .forEach(project => {
                const projectEl = container.createDiv({ cls: 'project-item', text: project.name });
                projectEl.addEventListener('click', () => {
                    this.onSelect(project.id);
                    this.close();
                });
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
