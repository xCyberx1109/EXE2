export const asyncHandler = (fn) => (req, res, next) => {
  let aborted = false;
  const cleanup = () => { aborted = true; };
  req.on('close', cleanup);

  Promise.resolve(fn(req, res, next))
    .catch((err) => {
      if (aborted) {
        console.warn(`[Skipped Error] ${req.method} ${req.originalUrl} — client disconnected, err: ${err.message}`);
        return;
      }
      next(err);
    })
    .finally(() => {
      req.off('close', cleanup);
    });
};
