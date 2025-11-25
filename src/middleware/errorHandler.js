const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('Error:', err);

  if (err.name === 'CastError') {
    const message = 'Recurso no encontrado';
    error = { message, status: false, statusCode: 404 };
  }

  if (err.code === 11000) {
    let message = 'Datos duplicados';
    if (err.message.includes('correo')) {
      message = 'Ya existe un usuario con este correo electrónico';
    } else if (err.message.includes('dni')) {
      message = 'Ya existe un cliente con este DNI';
    } else if (err.message.includes('email')) {
      message = 'Ya existe un registro con este email';
    }
    error = { message, status: false, statusCode: 400 };
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, status: false, statusCode: 400 };
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = { message, status: false, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = { message, status: false, statusCode: 401 };
  }


  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'El archivo es demasiado grande';
    error = { message, status: false, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Tipo de archivo no permitido';
    error = { message, status: false, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    status: false,
    message: error.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && {
      error: err.message,
      stack: err.stack
    })
  });
};

module.exports = { errorHandler };