/**
 * Enrichments MFE - Types
 *
 * Domain types for enrichments, comments, diffs, PRs, edits, and commits.
 * These are the MFE-local copies of the types that were previously in
 * the host app's wikiTypes.ts enrichment section.
 */

export enum EnrichmentType {
  Comment = 'comment',
  Diff = 'diff',
  PRDiff = 'pr_diff',
  LocalChange = 'local_change',
  Edit = 'edit',
  Commit = 'commit',
  Conflict = 'conflict',
}

export type CommentUser = {
  username: string;
};

export type CommentData = {
  id: string;
  source_uri: string;
  line_start: number | null;
  line_end: number | null;
  text: string;
  /** Author user id (numeric, from Django auth_user). */
  author?: number | null;
  /** Author username — the field actually populated by the backend. */
  author_username?: string | null;
  thread_id: string;
  parent_comment: string | null;
  is_resolved: boolean;
  anchoring_status: string;
  created_at: string;
  updated_at: string;
  replies?: CommentData[];
};

export type DiffHunk = {
  old_start: number;
  old_count: number;
  new_start: number;
  new_count: number;
  lines: string[];
};

export type DiffHunkRaw = {
  old_start: number;
  old_count: number;
  new_start: number;
  new_count: number;
  lines: string[];
};

export type DiffEnrichment = {
  type: EnrichmentType.Diff;
  id: string;
  file_path: string;
  description: string;
  status: string;
  diff_hunks: DiffHunk[];
  diff_text: string;
  created_at: string;
  updated_at: string;
  stats: {
    additions: number;
    deletions: number;
    total_changes: number;
  };
};

export type LocalChangeEnrichment = {
  type: EnrichmentType.LocalChange;
  id: number;
  file_path: string;
  commit_message: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PRReviewer = {
  username: string;
  display_name: string;
  avatar_url: string;
  role: string;
  status: string;
};

export type PREnrichment = {
  type: EnrichmentType.PRDiff;
  pr_number: number;
  pr_title: string;
  pr_author: string;
  pr_state: string;
  pr_url: string;
  created_at: string;
  reviewers?: PRReviewer[];
  diff_hunks?: DiffHunk[];
};

export enum EditChangeType {
  Modify = 'modify',
  Create = 'create',
  Delete = 'delete',
}

export enum DraftAction {
  Commit = 'commit',
  Discard = 'discard',
}

export type EditEnrichment = {
  type: EnrichmentType.Edit;
  id: string;
  space_id: string;
  space_slug: string;
  file_path: string;
  change_type: EditChangeType;
  description: string;
  user: string;
  user_full_name: string;
  created_at: string;
  updated_at: string;
  diff_hunks?: DiffHunk[];
  actions: DraftAction[];
};

export enum CommitAction {
  Unstage = 'unstage',
  CreatePr = 'create_pr',
  ViewPr = 'view_pr',
}

export type CommitEnrichment = {
  type: EnrichmentType.Commit;
  id: string;
  space_id: string;
  space_slug: string;
  file_path: string;
  branch_name: string;
  base_branch: string;
  task_name?: string | null;
  commit_sha: string | null;
  user: string;
  user_full_name: string;
  created_at: string;
  updated_at: string;
  diff_hunks?: DiffHunk[];
  additions?: number;
  deletions?: number;
  pr_id?: number | null;
  pr_url?: string | null;
  actions: CommitAction[];
};

export type EnrichmentsResponse = {
  comments?: CommentData[];
  diff?: DiffEnrichment[];
  local_changes?: LocalChangeEnrichment[];
  pr_diff?: PREnrichment[];
  edit?: EditEnrichment[];
  commit?: CommitEnrichment[];
};

export enum EnrichmentTab {
  All = 'all',
  Comments = 'comments',
  Diffs = 'diffs',
  PRs = 'prs',
  Local = 'local',
  Changes = 'changes',
  Debug = 'debug',
}

export interface EnrichmentPayload {
  current_hunk?: DiffHunkRaw;
  diff_hunks?: DiffHunkRaw[];
  id?: string;
  pr_number?: number;
  pr_title?: string;
  pr_author?: string;
  pr_state?: string;
  pr_url?: string;
  commit_sha?: string;
  actions?: string[];
  firstEnrichment?: Enrichment;
  secondEnrichment?: Enrichment;
  hunk?: DiffHunkRaw;
  [key: string]: string | number | boolean | null | undefined | string[] | DiffHunkRaw[] | DiffHunkRaw | Enrichment | Enrichment[];
}

export type Enrichment = {
  id: string;
  type: string;
  lineStart: number;
  lineEnd: number;
  data: EnrichmentPayload;
};

/**
 * Recursive JSON-safe value type — MFE-local mirror of the host's ExtraJsonValue.
 * Used instead of `unknown` for open-ended JSON payloads.
 */
export type ExtraJsonValue =
  | string
  | number
  | boolean
  | null
  | ExtraJsonValue[]
  | { [key: string]: ExtraJsonValue };

export enum GitOpsLogStatus {
  Ok = 'ok',
  Error = 'error',
  Skip = 'skip',
}

export type GitOpsLogEntry = {
  ts: number;
  kind: string;
  status: GitOpsLogStatus;
  message: string;
  space_slug: string;
  branch_name: string;
  payload: Record<string, ExtraJsonValue>;
};

export type GitOpsLogResponse = {
  entries: GitOpsLogEntry[];
};
