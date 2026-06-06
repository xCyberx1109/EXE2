export const asyncHandler = (fn) => (req, res, next) => {
  let aborted = false;
  const cleanup = () => { aborted = true; };
  req.on('close', cleanup);

  Promise.resolve(fn(req, res, next))
    .catch((err) => {
      if (aborted) {
        console.warn(`[AsyncHandler] Request aborted — ${req.method} ${req.originalUrl}, err: ${err.message}`);
      }
      next(err);
    })
    .finally(() => {
      req.off('close', cleanup);
    });
};
