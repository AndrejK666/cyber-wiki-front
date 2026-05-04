/**
 * CreateFileModal — GitHub-style "create new file in repo" dialog.
 *
 * The new file lives as a draft change with `change_type = create` until the
 * user commits it via the FileViewer or the Changes page. That keeps the
 * single review/commit pipeline — no special "create immediately" path.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { FileText, Upload, X } from 'lucide-react';
import { saveDraft } from '@/app/actions/draftChangeActions';
import { EditChangeType, type Space } from '@/app/api';
import { Modal, ModalSize } from '@/app/components/primitives/Modal';

export enum CreateFileMode {
  Create = 'create',
  Import = 'import',
}

interface CreateFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space;
  /** Optional folder path the new file should be created inside (no leading
   *  slash, no trailing slash). Defaults to the repo root. */
  initialFolder?: string;
  /** "create" lets the user type a filename and contents; "import" lets them
   *  upload one or more files from disk. Defaults to "create". */
  initialMode?: CreateFileMode;
  /** Called once the new draft has been created. Receives the full file
   *  path *and* the freshly-minted draft id so the parent can wire the file
   *  viewer up immediately, without waiting for the drafts list to re-fetch.
   *  When importing several files, called once per file. */
  onCreated?: (filePath: string, draftId: string) => void;
}

interface PendingUpload {
  /** Path the file will be created at, relative to repo root. */
  path: string;
  /** Plaintext contents of the file (binary uploads are skipped). */
  content: string;
}

export function CreateFileModal({
  isOpen,
  onClose,
  space,
  initialFolder,
  initialMode = CreateFileMode.Create,
  onCreated,
}: CreateFileModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CreateFileMode>(initialMode);
  const [folder, setFolder] = useState(initialFolder ?? '');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset on open so a stale value from a previous session doesn't carry over.
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFolder(initialFolder ?? '');
      setName('');
      setContent('');
      setUploads([]);
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, initialFolder, initialMode]);

  // The full path that will be stored on the draft. Folder + name, normalized
  // — strip leading/trailing slashes on the folder, no leading slash overall.
  const filePath = useMemo(() => {
    const f = folder.replace(/^\/+|\/+$/g, '');
    const n = name.trim();
    if (!n) return '';
    return f ? `${f}/${n}` : n;
  }, [folder, name]);

  // Listen for the saved-event so we can navigate to the new file. In Import
  // mode we fire one saveDraft per file and only close after all are saved —
  // counters and the queued path list are held in refs so the closure doesn't
  // go stale. Each saved draft fires onCreated with its path + id.
  const expectedSavesRef = useRef(0);
  const completedSavesRef = useRef(0);
  /** Paths queued for save in submission order — first matches first saved. */
  const queuedPathsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const sub = eventBus.on('wiki/draft/saved', ({ changeId }) => {
      const path = queuedPathsRef.current.shift();
      if (path && changeId) onCreated?.(path, changeId);
      completedSavesRef.current += 1;
      if (completedSavesRef.current >= expectedSavesRef.current) {
        setSubmitting(false);
        onClose();
      }
    });
    const errSub = eventBus.on('wiki/draft/error', ({ error: msg }) => {
      setSubmitting(false);
      setError(msg);
    });
    return () => {
      sub.unsubscribe();
      errSub.unsubscribe();
    };
  }, [isOpen, onClose, onCreated]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === CreateFileMode.Create) {
      if (!filePath) return;
      setSubmitting(true);
      setError(null);
      expectedSavesRef.current = 1;
      completedSavesRef.current = 0;
      queuedPathsRef.current = [filePath];
      saveDraft({
        spaceId: space.id,
        filePath,
        originalContent: '',
        modifiedContent: content,
        changeType: EditChangeType.Create,
        description: t('createFile.createDescription', { path: filePath }),
      });
      return;
    }
    // Import mode — push one draft per uploaded file.
    if (uploads.length === 0) return;
    setSubmitting(true);
    setError(null);
    expectedSavesRef.current = uploads.length;
    completedSavesRef.current = 0;
    queuedPathsRef.current = uploads.map((u) => u.path);
    for (const u of uploads) {
      saveDraft({
        spaceId: space.id,
        filePath: u.path,
        originalContent: '',
        modifiedContent: u.content,
        changeType: EditChangeType.Create,
        description: t('createFile.importDescription', { path: u.path }),
      });
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const f = folder.replace(/^\/+|\/+$/g, '');
    const next: PendingUpload[] = [];
    setError(null);
    for (const file of Array.from(fileList)) {
      // We only handle text-ish files: drafts store strings, not binary.
      // Reject anything > 5 MB or that fails to decode as UTF-8.
      if (file.size > 5 * 1024 * 1024) {
        setError(t('createFile.skippedTooLarge', { name: file.name }));
        continue;
      }
      try {
        const text = await file.text();
        const path = f ? `${f}/${file.name}` : file.name;
        next.push({ path, content: text });
      } catch {
        setError(t('createFile.skippedNotText', { name: file.name }));
      }
    }
    setUploads((prev) => [...prev, ...next]);
  };

  const submitDisabled =
    submitting || (mode === CreateFileMode.Create ? !filePath : uploads.length === 0);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size={ModalSize.X2}
      title={t('createFile.title')}
      titleIcon={<FileText size={16} className="text-muted-foreground" />}
    >
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setMode(CreateFileMode.Create)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${
              mode === CreateFileMode.Create
                ? 'border-primary text-foreground bg-accent/40'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText size={14} />
            {t('createFile.tabCreate')}
          </button>
          <button
            type="button"
            onClick={() => setMode(CreateFileMode.Import)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${
              mode === CreateFileMode.Import
                ? 'border-primary text-foreground bg-accent/40'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload size={14} />
            {t('createFile.tabImport')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-md border border-destructive bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {mode === CreateFileMode.Create ? t('createFile.fileLocation') : t('createFile.destinationFolder')}
            </label>
            <div className="flex items-center gap-1 text-sm">
              <code className="px-2 py-2 rounded-md bg-muted text-muted-foreground border border-border">
                {space.slug}
              </code>
              <span className="text-muted-foreground">/</span>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder={t('createFile.folderPlaceholder')}
                className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {mode === CreateFileMode.Create && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('createFile.filenamePlaceholder')}
                    className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </>
              )}
            </div>
            {mode === CreateFileMode.Create && filePath && (
              <p className="text-xs text-muted-foreground">
                {t('createFile.willBeCreatedAt')}{' '}
                <code className="font-mono">{space.slug}/{filePath}</code>
              </p>
            )}
          </div>

          {mode === CreateFileMode.Create && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                {t('createFile.fileContents')}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('createFile.contentsPlaceholder')}
                rows={12}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                spellCheck={false}
              />
            </div>
          )}

          {mode === CreateFileMode.Import && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                {t('createFile.filesToImport')}
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-md border-2 border-dashed border-border hover:border-primary hover:bg-accent/30 transition-colors text-center"
              >
                <Upload size={20} className="text-muted-foreground" />
                <p className="text-sm text-foreground">
                  {t('createFile.dropHint')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('createFile.dropFootnote')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>

              {uploads.length > 0 && (
                <ul className="border border-border rounded-md divide-y divide-border bg-background">
                  {uploads.map((u, i) => (
                    <li
                      key={`${u.path}-${i}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm"
                    >
                      <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                      <code className="flex-1 truncate text-foreground">{u.path}</code>
                      <span className="text-xs text-muted-foreground">
                        {t('createFile.charCount', { count: u.content.length })}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setUploads((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="p-1 rounded text-muted-foreground hover:text-destructive"
                        title={t('createFile.removeUpload')}
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {t('createFile.footerHint', {
              subject: mode === CreateFileMode.Create ? t('createFile.footerSubjectFile') : t('createFile.footerSubjectEach'),
            })}
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm text-foreground hover:bg-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting
                ? t('createFile.saving')
                : mode === CreateFileMode.Create
                  ? t('createFile.createFile')
                  : t(uploads.length === 1 ? 'createFile.importFiles' : 'createFile.importFiles_plural', {
                      count: uploads.length,
                    })}
            </button>
          </div>
        </form>
    </Modal>
  );
}
