const notFound = (req, res, next) => {
  res.status(404).json({
    status: false,
    message: `Ruta no encontrada: ${req.originalUrl}`,
    availableRoutes: {
      auth: '/API/Usuario',
      properties: '/API/Propiedad',
      clients: '/API/Cliente',
      reservations: '/API/Reserva',
      contact: '/API/Contacto',
      tasaciones: '/API/Tasacion',
      health: '/health'
    }
  });
};

module.exports = { notFound };
