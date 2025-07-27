import { requestUrl } from 'obsidian';

export class RedmineClient {
    constructor(public redmineUrl: string, private apiKey: string) {}

    private async request(method: 'GET' | 'POST', path: string, body?: any) {
        const url = `${this.redmineUrl}/${path}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-Redmine-API-Key': this.apiKey,
        };

        try {
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
        } catch (e) {
            throw new Error('Network error. Please check your Redmine URL and connection.');
        }
    }

    async getProjects(): Promise<any> {
        const limit = 100;
        let offset = 0;
        let allProjects = [];
        let totalCount = 0;

        do {
            const response = await this.request('GET', `projects.json?limit=${limit}&offset=${offset}`);
            allProjects = allProjects.concat(response.projects);
            totalCount = response.total_count;
            offset += limit;
        } while (offset < totalCount);

        return { projects: allProjects };
    }

    async getIssues(userId: string): Promise<any> {
        return this.request('GET', `issues.json?assigned_to_id=${userId}`);
    }

    async createIssue(issue: any): Promise<any> {
        try {
            return this.request('POST', 'issues.json', { issue });
        } catch (e) {
            console.error(e);
            throw e;
        }
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
        const limit = 100;
        let offset = 0;
        let allUsers = [];
        let hasMore = true;

        while (hasMore) {
            const response = await this.request('GET', `users.json?limit=${limit}&offset=${offset}`);
            allUsers = allUsers.concat(response.users);
            if (response.users.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
            }
        }

        return { users: allUsers, total_count: allUsers.length };
    }

    async testConnection(): Promise<any> {
        return this.request('GET', 'my/account.json');
    }

    async getTrackers(): Promise<any> {
        return this.request('GET', 'trackers.json');
    }

    async getProjectMemberships(projectId: string): Promise<any> {
        const limit = 100;
        let offset = 0;
        let allMemberships = [];
        let hasMore = true;

        while (hasMore) {
            const response = await this.request('GET', `projects/${projectId}/memberships.json?limit=${limit}&offset=${offset}`);
            allMemberships = allMemberships.concat(response.memberships);
            if (response.memberships.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
            }
        }

        return { memberships: allMemberships, total_count: allMemberships.length };
    }
}
