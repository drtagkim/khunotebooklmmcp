import { NotebookLMClient } from './api-client.js';
import { RPC_IDS, STUDIO_TYPES } from './constants.js';

export class NotebookOrchestrator {
    constructor(private client: NotebookLMClient) { }

    async performDeepWebResearch(notebookId: string, query: string, mode: 'deep' | 'fast' = 'deep'): Promise<any> {
        console.error(`Starting ${mode} web research for ${notebookId}: ${query}`);

        // 1. Start research
        const startResult = await this.client['startResearch'](notebookId, query, 'web', mode);
        if (!startResult || !startResult.task_id) {
            throw new Error('Failed to start research task');
        }

        const taskId = startResult.task_id;

        // 2. Polling loop
        let completedTask = null;
        const maxAttempts = 60; // 5 seconds * 60 = 5 minutes
        for (let i = 0; i < maxAttempts; i++) {
            console.error(`Polling research task ${taskId} (Attempt ${i + 1}/${maxAttempts})...`);
            const status = await this.client['pollResearch'](notebookId, taskId);

            if (status && status.status === 'completed') {
                completedTask = status;
                break;
            }

            if (status && status.status === 'no_research') {
                // This is where the old server failed. We should handle it gracefully.
                // Maybe try one more time or check if it was already imported?
                console.error('Research task lost by Google, attempting to recover...');
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (!completedTask) {
            throw new Error('Research timed out or failed');
        }

        // 3. Import sources
        console.error(`Importing ${completedTask.sources.length} sources...`);
        const importResult = await this.client['importResearchSources'](notebookId, taskId, completedTask.sources);

        return {
            status: 'success',
            importedCount: completedTask.sources.length,
            task: completedTask
        };
    }

    async generateArtifact(
        notebookId: string,
        type: 'audio' | 'video' | 'quiz' | 'slides' | 'infographic' | 'report' | 'mind_map' | 'data_table' | 'flashcards',
        config: any
    ): Promise<any> {
        console.error(`Generating ${type} artifact for notebook ${notebookId}`);

        if (type === 'mind_map') {
            // Use specific Mind Map RPC
            return this.client.generateMindMap(notebookId, config?.sourceIds);
        }

        // Map other types to Studio types
        let studioType: string;
        switch (type) {
            case 'audio': studioType = STUDIO_TYPES.AUDIO; break;
            case 'video': studioType = STUDIO_TYPES.VIDEO; break;
            case 'quiz': studioType = STUDIO_TYPES.QUIZ; break;
            case 'slides': studioType = STUDIO_TYPES.SLIDE_DECK; break;
            case 'infographic': studioType = STUDIO_TYPES.INFOGRAPHIC; break;
            case 'report': studioType = STUDIO_TYPES.REPORT; break;
            case 'data_table': studioType = STUDIO_TYPES.DATA_TABLE; break;
            case 'flashcards': studioType = STUDIO_TYPES.FLASHCARDS; break;
            default:
                throw new Error(`Unsupported artifact type: ${type}`);
        }

        // Call generic studio creation
        return this.client.createStudioArtifact(notebookId, studioType, config);
    }
}
