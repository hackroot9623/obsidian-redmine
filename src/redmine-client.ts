import { requestUrl } from 'obsidian';

export class RedmineClient {
    constructor(public redmineUrl: string, private apiKey: string) {}

    private async request(method: 'GET' | 'POST', path: string, body?: any) {
        const url = `${this.redmineUrl}/${path}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-Redmine-API-Key': this.apiKey,
        };

        const response = await requestUrl({
            method,
            url,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status >= 400) {
            throw new Error(`Redmine API error: ${response.status} - ${response.text}`);
        }

        return response.json;
    }

    async getProjects(): Promise<any> {
        return this.request('GET', 'projects.json');
    }

    async getIssues(userId: string): Promise<any> {
        return this.request('GET', `issues.json?assigned_to_id=${userId}`);
    }

    async createIssue(issue: any): Promise<any> {
        return this.request('POST', 'issues.json', { issue });
    }

    async logTime(issueId: number, hours: string): Promise<any> {
        return this.request('POST', 'time_entries.json', {
            time_entry: {
                issue_id: issueId,
                hours: hours,
            },
        });
    }

    async getUsers(): Promise<any> {
        return this.request('GET', 'users.json');
    }
}
