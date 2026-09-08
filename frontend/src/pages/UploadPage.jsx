import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FolderOpen,
  RefreshCw,
  Trash2,
  GitBranch,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { listDocuments, uploadDocument } from '../lib/api.js';

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
};

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function validateFile(file) {
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return 'Only PDF and TXT files are supported.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File is larger than the 10MB limit.';
  }
  return null;
}

function StatusPill({ status }) {
  if (status === 'ready') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-code-sm text-code-sm text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Ready
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-error-container px-3 py-1 font-code-sm text-code-sm text-error">
        <span className="h-1.5 w-1.5 rounded-full bg-error" />
        Failed
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary-container/50 px-3 py-1 font-code-sm text-code-sm text-secondary">
      <span className="inline-block h-2 w-2 animate-spin rounded-full border border-secondary border-t-transparent" />
      {status === 'uploading' ? 'Uploading' : 'Processing'}
    </span>
  );
}

function UploadPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef(null);

  const refreshDocuments = useCallback(async () => {
    try {
      const { documents: docs } = await listDocuments(token);
      setDocuments(docs);
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList);

    for (const file of files) {
      const validationError = validateFile(file);
      const pendingId = `${file.name}-${Date.now()}-${Math.random()}`;

      if (validationError) {
        setPendingUploads((prev) => [...prev, { id: pendingId, filename: file.name, error: validationError }]);
        continue;
      }

      setPendingUploads((prev) => [...prev, { id: pendingId, filename: file.name, sizeBytes: file.size, error: null }]);

      try {
        await uploadDocument({ token, file });
        await refreshDocuments();
      } catch (err) {
        setPendingUploads((prev) => prev.map((p) => (p.id === pendingId ? { ...p, error: err.message } : p)));
        continue;
      }

      setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
    }
  }

  function handleInputChange(e) {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter.current += 1;
    setDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setDragging(false);
  }

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const totalEmbeddings = readyDocs.reduce((sum, d) => sum + (d.chunkCount || 0), 0);
  const hasAnything = pendingUploads.length > 0 || documents.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-col">
        <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-on-surface">Documents</h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          Manage your indexed tenant corpus. Uploaded files are chunked, embedded, and isolated to your organization's
          vector store.
        </p>
      </div>

      {/* Drag-and-drop zone */}
      <label
        className={clsx(
          'group relative mb-10 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl p-10 text-center transition-all duration-200',
          dragging ? 'bg-surface-container' : 'bg-surface-container-low hover:bg-surface-container'
        )}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          multiple
          onChange={handleInputChange}
          aria-label="Upload documents"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <div
          className={clsx(
            'flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-outline transition-colors',
            dragging ? 'text-primary' : 'group-hover:text-primary'
          )}
        >
          <UploadCloud size={28} />
        </div>
        <p className="mt-4 font-title-sm text-title-sm text-on-surface">Drag &amp; drop a file, or browse</p>
        <p className="mt-1 font-code-sm text-code-sm text-outline">PDF or TXT, up to 10MB</p>
        <span className="pointer-events-none mt-5 flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2 font-label-md text-label-md text-on-surface transition-colors group-hover:bg-surface-bright">
          <FolderOpen size={16} className="text-outline" />
          Select File
        </span>
      </label>

      {/* Section header + telemetry */}
      <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="font-code-sm text-code-sm uppercase tracking-wider text-outline">Your Documents</span>
          <span className="rounded-full bg-surface-container px-2 py-0.5 font-code-sm text-code-sm font-medium text-outline">
            {documents.length} file{documents.length === 1 ? '' : 's'} indexed
          </span>
        </div>
        <div className="flex items-center gap-4 rounded-lg bg-surface-container-lowest px-3 py-1.5 font-code-sm text-code-sm text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span className="font-semibold text-on-surface">Total Embeddings:</span>
            <span>{totalEmbeddings} vectors</span>
          </div>
          <span className="text-outline-variant">/</span>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-on-surface">Index:</span>
            <span>HNSW-Cosine</span>
          </div>
        </div>
      </div>

      {!loadingList && !hasAnything && (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-outline">
          <FolderOpen size={32} className="opacity-50" />
          <p className="font-body-md text-body-md">No documents yet — upload your first file to get started.</p>
        </div>
      )}

      {hasAnything && (
        <motion.div className="space-y-3" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
          <AnimatePresence initial={false}>
            {pendingUploads.map((p) => (
              <motion.div
                key={p.id}
                layout
                variants={rowVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="rounded-xl bg-surface-container p-4 transition-all duration-150"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                      {p.error ? <AlertTriangle size={20} /> : <Loader2 size={20} className="animate-spin" />}
                    </div>
                    <div className="min-w-0">
                      <span className="truncate font-code-md text-code-md font-medium text-on-surface">{p.filename}</span>
                      <p className="mt-0.5 truncate font-code-sm text-code-sm text-outline">{p.error || 'Uploading…'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end pl-13 sm:self-center sm:pl-0">
                    <StatusPill status={p.error ? 'failed' : 'uploading'} />
                  </div>
                </div>
              </motion.div>
            ))}

            {documents.map((doc) => (
              <motion.div
                key={doc.id}
                layout
                variants={rowVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="rounded-xl bg-surface-container p-4 transition-all duration-150 hover:bg-surface-bright/40"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
                    <div
                      className={clsx(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high',
                        doc.status === 'failed' ? 'text-error' : 'text-on-surface'
                      )}
                    >
                      {doc.status === 'failed' ? <X size={20} /> : <FileText size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-code-md text-code-md font-medium text-on-surface">{doc.filename}</span>
                      </div>
                      <p className={clsx('mt-0.5 truncate font-code-sm text-code-sm', doc.status === 'failed' ? 'text-error/80' : 'text-outline')}>
                        {doc.status === 'failed'
                          ? doc.error || 'Processing failed'
                          : `${doc.chunkCount} chunk${doc.chunkCount === 1 ? '' : 's'} · ${formatBytes(doc.sizeBytes)} · Uploaded ${formatRelativeTime(doc.createdAt)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end pl-13 sm:self-center sm:pl-0">
                    <StatusPill status={doc.status} />
                    <div className="flex items-center gap-1">
                      {doc.status === 'failed' ? (
                        <button
                          type="button"
                          title="Retry pipeline execution"
                          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 font-code-sm text-code-sm text-error transition-colors hover:bg-error-container/40 hover:text-on-error-container"
                        >
                          <RefreshCw size={15} />
                          Retry
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Force reconstruct chunk graph"
                          disabled={doc.status === 'processing'}
                          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 font-code-sm text-code-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RefreshCw size={15} />
                          Re-index
                        </button>
                      )}
                      <button
                        type="button"
                        title="Delete document and purge vectors"
                        className="rounded-md p-1.5 text-outline transition-colors hover:bg-surface-container-high hover:text-error"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Pipeline spec panel */}
      <div className="mt-12 rounded-xl bg-surface-container-low p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={20} className="text-primary" />
            <h2 className="font-title-sm text-title-sm text-on-surface">Tenant Embedding Pipeline Specs</h2>
          </div>
          <span className="font-code-sm text-code-sm text-outline">Deterministic Chunker</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-surface-container p-3">
            <span className="block font-code-sm text-code-sm text-outline">Chunking Strategy</span>
            <span className="mt-1 block font-title-sm text-title-sm text-on-surface">Recursive Token Split</span>
            <span className="mt-0.5 block font-code-sm text-code-sm text-outline">500 tokens / 50 overlap</span>
          </div>
          <div className="rounded-lg bg-surface-container p-3">
            <span className="block font-code-sm text-code-sm text-outline">Embedding Model</span>
            <span className="mt-1 block font-title-sm text-title-sm text-on-surface">gemini-embedding-001</span>
            <span className="mt-0.5 block font-code-sm text-code-sm text-outline">1536-dim normalized</span>
          </div>
          <div className="rounded-lg bg-surface-container p-3">
            <span className="block font-code-sm text-code-sm text-outline">Vector Store Shard</span>
            <span className="mt-1 block font-title-sm text-title-sm text-on-surface">pgvector (HNSW)</span>
            <span className="mt-0.5 block font-code-sm text-code-sm text-outline">hybrid BM25 + rerank-english-v3.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UploadPage;
