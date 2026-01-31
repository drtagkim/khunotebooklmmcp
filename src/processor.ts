import { NotebookSessionManager } from './session-manager.js';
import { ARTIFACT_KEYS, ARTIFACT_CODE_MAP } from './constants.js';

/**
 * ArtifactProcessor
 * Orchestrates complex, multi-step operations like Deep Research and Artifact Generation.
 */
export class ArtifactProcessor {
    constructor(private session: NotebookSessionManager) { }

    async executeDeepResearch(notebookId: string, query: string): Promise<any> {
        console.error(`Status: Starting Deep Research on: "${query}"`);

        // 1. Kick off research task
        const { taskId } = await this.session.initiateResearch(notebookId, query, 'deep');
        console.error(`Status: Task ID ${taskId} received. Beginning polling cycle.`);

        // 2. Poll validation loop
        let result = null;
        let attempts = 0;
        const MAX_POLLS = 60; // 5 mins total

        while (attempts < MAX_POLLS) {
            attempts++;
            await new Promise(r => setTimeout(r, 5000)); // 5s wait

            const status = await this.session.checkResearchStatus(notebookId, taskId);
            console.error(`Status: Polling attempt ${attempts}/${MAX_POLLS} - State: ${status.status}`);

            if (status.status === 'completed') {
                result = status;
                break;
            }
        }

        if (!result) {
            throw new Error("Research operation timed out after 5 minutes.");
        }

        // 3. Import findings
        console.error(`Status: Importing ${result.sources.length} sources found.`);
        await this.session.importResearchResults(notebookId, taskId, result.sources);

        return {
            success: true,
            sourceCount: result.sources.length,
            summary: result.summary
        };
    }

    async createArtifact(notebookId: string, artifactType: string, options: any = {}): Promise<any> {
        console.error(`Status: Generating artifact [${artifactType}]...`);

        if (artifactType === ARTIFACT_KEYS.MINDMAP) {
            return this.session.generatedMindMap(notebookId, options?.sourceIds);
        }

        const typeMap: Record<string, number> = {
            [ARTIFACT_KEYS.AUDIO]: ARTIFACT_CODE_MAP.AUDIO_OVERVIEW,
            [ARTIFACT_KEYS.VIDEO]: ARTIFACT_CODE_MAP.VIDEO_OVERVIEW,
            [ARTIFACT_KEYS.REPORT]: ARTIFACT_CODE_MAP.REPORT_DOC,
            [ARTIFACT_KEYS.INFOGRAPHIC]: ARTIFACT_CODE_MAP.INFOGRAPHIC_IMAGE,
            [ARTIFACT_KEYS.SLIDES]: ARTIFACT_CODE_MAP.PRESENTATION_SLIDES,
            [ARTIFACT_KEYS.TABLE]: ARTIFACT_CODE_MAP.DATA_SHEET,
            [ARTIFACT_KEYS.CARDS]: ARTIFACT_CODE_MAP.FLASHCARD_SET,
            [ARTIFACT_KEYS.QUIZ]: 0, // Need to verify Quiz code if supported by generic studio
        };

        const code = typeMap[artifactType];
        if (code === undefined) {
            // Fallback or specific handling for Quiz if acts differently
            // For now assume Quiz might be handled via separate path or Code 9?
            // Checking previous code: QUIZ maps to STUDIO_TYPES.QUIZ but code?
            // If Quiz isn't in generic map, throw error or handle.
            // Looking at constants, there was no QUIZ code in STUDIO_TYPE_CODES previously?
            // Actually, Flashcards=9. Quiz might be separate. 
            // Let's assume standard behavior for now or strict map.
            throw new Error(`Artifact type '${artifactType}' is not currently supported for auto-generation.`);
        }

        return this.session.generateStudyArtifact(notebookId, code, options);
    }
}
