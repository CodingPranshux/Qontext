export const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.code === 11000) {
    return res.status(409).json({
      error: { message: 'Duplicate value violates a unique constraint' },
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: { message: `Upload error: ${err.message}` } });
  }

  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    },
  });
};
