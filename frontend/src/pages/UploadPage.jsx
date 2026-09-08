import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, FolderOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { listDocuments, uploadDocument } from '../lib/api.js';
import { cardClasses } from '../components/ui/Card.jsx';

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
};

const badgeVariants = {
  initial: { scale: 0.5, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 500, damping: 15 } },
  exit: { scale: 0.7, opacity: 0, transition: { duration: 0.12 } },
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

// Animates the badge itself swapping (pulsing "processing" -> spring-in "ready"),
// distinct from the row it lives in.
function StatusBadge({ status }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {status === 'ready' && (
        <motion.span
          key="ready"
          {...badgeVariants}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success"
        >
          <CheckCircle2 size={12} />
          Ready
        </motion.span>
      )}
      {status === 'failed' && (
        <motion.span
          key="failed"
          {...badgeVariants}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger"
        >
          <AlertTriangle size={12} />
          Failed
        </motion.span>
      )}
      {status === 'processing' && (
        <motion.span
          key="processing"
          {...badgeVariants}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning"
        >
          <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-current motion-reduce:animate-none" />
          Processing
        </motion.span>
      )}
      {status === 'uploading' && (
        <motion.span
          key="uploading"
          {...badgeVariants}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning"
        >
          <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-current motion-reduce:animate-none" />
          Uploading
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function UploadPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [pendingUploads, setPendingUploads] = useState([]); // [{ id, filename, sizeBytes, error }]
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

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

      setPendingUploads((prev) => [
        ...prev,
        { id: pendingId, filename: file.name, sizeBytes: file.size, error: null },
      ]);

      try {
        await uploadDocument({ token, file });
        await refreshDocuments();
      } catch (err) {
        setPendingUploads((prev) =>
          prev.map((p) => (p.id === pendingId ? { ...p, error: err.message } : p))
        );
        continue;
      }

      setPendingUploads((prev) => prev.filter((p) => p.id !== pendingId));
    }
  }

  function handleInputChange(e) {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = ''; // allow re-selecting the same file
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

  const hasAnything = pendingUploads.length > 0 || documents.length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 pb-12">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-text">Documents</h1>
        <p className="mt-1 text-[0.95rem] text-text-secondary">
          Upload files to make them searchable in chat, with citations back to the exact source.
        </p>
      </div>

      <label
        className={clsx(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-11 text-center transition-all duration-200 ease-out',
          dragging
            ? 'scale-[1.01] border-accent bg-accent/5 shadow-glow'
            : 'border-border bg-surface hover:border-accent/40'
        )}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept=".pdf,.txt"
          multiple
          onChange={handleInputChange}
          aria-label="Upload documents"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <div
          className={clsx(
            'mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform duration-200',
            dragging && 'scale-110'
          )}
        >
          <UploadCloud size={24} />
        </div>
        <h3 className="mb-1 text-sm font-semibold text-text">
          Drag &amp; drop a file, or <span className="font-semibold text-accent">browse</span>
        </h3>
        <p className="text-xs text-text-secondary">PDF or TXT, up to 10MB</p>
      </label>

      {!loadingList && !hasAnything && (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-text-tertiary">
          <FolderOpen size={32} className="opacity-50" />
          <p className="text-sm">No documents yet — upload your first file to get started.</p>
        </div>
      )}

      {hasAnything && (
        <motion.div
          className="mt-7 flex flex-col gap-2"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">Your documents</p>

          <AnimatePresence initial={false}>
            {pendingUploads.map((p) => (
              <motion.div
                key={p.id}
                layout
                variants={rowVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cardClasses({})}
              >
                <div className="flex items-center gap-3.5 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-secondary">
                    {p.error ? <AlertTriangle size={17} /> : <Loader2 size={17} className="animate-spin" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-text">{p.filename}</div>
                    <div className="mt-0.5 text-xs text-text-tertiary">{p.error || 'Uploading…'}</div>
                  </div>
                  <StatusBadge status={p.error ? 'failed' : 'uploading'} />
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
                whileHover={{ y: -2 }}
                className={cardClasses({ hover: true })}
              >
                <div className="flex items-center gap-3.5 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-secondary">
                    <FileText size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-text">{doc.filename}</div>
                    <div className="mt-0.5 text-xs text-text-tertiary">
                      {doc.chunkCount} chunk{doc.chunkCount === 1 ? '' : 's'} · {formatBytes(doc.sizeBytes)} ·{' '}
                      {formatRelativeTime(doc.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

export default UploadPage;
