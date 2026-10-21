/**
 * Standard Task Status Normalizer and Progress Calculation
 */

export const normalizeTaskStatus = (status = '') => {
  const s = String(status || '').toLowerCase().trim().replace(/[- ]/g, '_');
  if (['pending', 'to_do', 'todo'].includes(s)) return 'pending';
  if (['assigned'].includes(s)) return 'assigned';
  if (['in_progress', 'working', 'doing', 'in-progress', 'active'].includes(s)) return 'in_progress';
  if (['testing'].includes(s)) return 'testing';
  if (['review', 'in_review'].includes(s)) return 'review';
  if (['completed', 'done', 'finished'].includes(s)) return 'completed';
  if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['delayed', 'delay'].includes(s)) return 'delayed';
  return s;
};

export const getProgressForStatus = (status) => {
  const normalized = normalizeTaskStatus(status);

  switch (normalized) {
    case "assigned":
    case "pending":
      return 5;
    case "in_progress":
      return 10;
    case "testing":
      return 75;
    case "review":
      return 90;
    case "completed":
      return 100;
    case "cancelled":
      return 0;
    case "delayed":
      return 25;
    default:
      return null;
  }
};

/**
 * Resolves the display/effective progress percentage of a task.
 * Respects custom manual progress if > 0 and status is not completed/cancelled,
 * otherwise falls back to the standard status progress percentage.
 */
export const getTaskProgress = (task) => {
  if (!task) return 0;
  const normalized = normalizeTaskStatus(task.status);
  const statusProgress = getProgressForStatus(task.status);

  if (normalized === 'completed') return 100;
  if (normalized === 'cancelled') return 0;

  if (typeof task.progress === 'number' && !isNaN(task.progress) && task.progress > 0) {
    return Math.min(100, Math.max(0, task.progress));
  }

  return statusProgress !== null ? statusProgress : 0;
};
