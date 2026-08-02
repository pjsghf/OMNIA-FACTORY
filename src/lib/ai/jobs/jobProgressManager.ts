export interface JobState {
  jobId: string;
  projectId: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentChapter: number;
  totalChapters: number;
  currentBlock: number;
  totalBlocks: number;
  progressPercent: number;
  statusText: string;
  error?: string;
  cancelledAt?: string;
}

class JobProgressManager {
  private jobs: Map<string, JobState> = new Map();

  createJob(jobId: string, projectId: string, totalChapters: number): JobState {
    const state: JobState = {
      jobId,
      projectId,
      status: 'idle',
      currentChapter: 0,
      totalChapters,
      currentBlock: 0,
      totalBlocks: 0,
      progressPercent: 0,
      statusText: 'Iniciando job...',
    };
    this.jobs.set(jobId, state);
    return state;
  }

  updateJob(jobId: string, update: Partial<JobState>): JobState | undefined {
    const existing = this.jobs.get(jobId);
    if (!existing) return undefined;

    const updated = { ...existing, ...update };
    if (updated.totalChapters > 0) {
      const chapterProgress = (updated.currentChapter / updated.totalChapters) * 100;
      const blockAddon =
        updated.totalBlocks > 0
          ? (updated.currentBlock / updated.totalBlocks) * (100 / updated.totalChapters)
          : 0;
      updated.progressPercent = Math.min(100, Math.round(chapterProgress + blockAddon));
    }

    this.jobs.set(jobId, updated);
    return updated;
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'cancelled';
      job.cancelledAt = new Date().toISOString();
      job.statusText = 'Geração cancelada pelo usuário.';
      return true;
    }
    return false;
  }

  getJob(jobId: string): JobState | undefined {
    return this.jobs.get(jobId);
  }

  isCancelled(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    return job?.status === 'cancelled';
  }
}

export const jobProgressManager = new JobProgressManager();
