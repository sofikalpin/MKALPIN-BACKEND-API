const express = require('express');
const Reservation = require('../models/Reservation');
const Property = require('../models/Property');
const { protect } = require('../middleware/auth');
const { validateReservation, validateId, handleValidationErrors } = require('../middleware/validation');
const { body, query } = require('express-validator');

const router = express.Router();

router.use(protect);

router.get('/Obtener', async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('idPropiedad', 'titulo direccion precio imagenes')
      .populate('idUsuarioCreador', 'nombre apellido')
      .sort({ fechaCreacion: -1 });

    res.json({
      status: true,
      message: 'Reservas obtenidas exitosamente',
      value: reservations
    });

  } catch (error) {
    console.error('Error obteniendo reservas:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/Obtener/:id', validateId, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate({
        path: 'idPropiedad',
        populate: {
          path: 'imagenes'
        }
      })
      .populate('idUsuarioCreador', 'nombre apellido');

    if (!reservation) {
      return res.status(404).json({
        status: false,
        message: 'Reserva no encontrada'
      });
    }

    res.json({
      status: true,
      message: 'Reserva obtenida exitosamente',
      value: reservation
    });

  } catch (error) {
    console.error('Error obteniendo reserva:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/PorPropiedad/:propertyId', validateId, async (req, res) => {
  try {
    const reservations = await Reservation.find({ idPropiedad: req.params.propertyId })
      .populate('idUsuarioCreador', 'nombre apellido')
      .sort({ fechaInicio: -1 });

    res.json({
      status: true,
      message: 'Reservas de la propiedad obtenidas exitosamente',
      value: reservations
    });

  } catch (error) {
    console.error('Error obteniendo reservas por propiedad:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/MisReservas', async (req, res) => {
  try {
    const reservations = await Reservation.find({ idUsuarioCreador: req.user._id })
      .populate({
        path: 'idPropiedad',
        populate: {
          path: 'imagenes'
        }
      })
      .populate('idUsuarioCreador', 'nombre apellido')
      .sort({ fechaCreacion: -1 });

    res.json({
      status: true,
      message: 'Reservas del usuario obtenidas exitosamente',
      value: reservations
    });

  } catch (error) {
    console.error('Error obteniendo reservas del usuario:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.post('/Crear', validateReservation, async (req, res) => {
  try {
    const { idPropiedad, fechaInicio, fechaFin } = req.body;

    const property = await Property.findOne({ _id: idPropiedad, activo: true });
    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    if (!property.esAlquilerTemporario) {
      return res.status(400).json({
        status: false,
        message: 'Esta propiedad no está disponible para alquiler temporario'
      });
    }

    const isAvailable = await Reservation.checkAvailability(
      idPropiedad, 
      new Date(fechaInicio), 
      new Date(fechaFin)
    );

    if (!isAvailable) {
      return res.status(400).json({
        status: false,
        message: 'La propiedad no está disponible en las fechas seleccionadas'
      });
    }

    const reservationData = {
      ...req.body,
      idUsuarioCreador: req.user._id
    };

    const reservation = new Reservation(reservationData);
    await reservation.save();

    if (req.body.depositoPagado && req.body.depositoPagado > 0) {
      reservation.pagos.push({
        monto: req.body.depositoPagado,
        metodoPago: req.body.metodoPago || 'No especificado',
        estadoPago: 'Pagado',
        notasPago: 'Depósito inicial'
      });
      await reservation.save();
    }

    await reservation.populate([
      { path: 'idPropiedad', select: 'titulo direccion' },
      { path: 'idUsuarioCreador', select: 'nombre apellido' }
    ]);

    res.status(201).json({
      status: true,
      message: 'Reserva creada exitosamente',
      value: reservation
    });

  } catch (error) {
    console.error('Error creando reserva:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.put('/Actualizar/:id', [
  validateId,
  body('fechaInicio')
    .optional()
    .isISO8601()
    .toDate(),
  body('fechaFin')
    .optional()
    .isISO8601()
    .toDate()
    .custom((value, { req }) => {
      if (req.body.fechaInicio && value <= new Date(req.body.fechaInicio)) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    }),
  body('montoTotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El monto total debe ser mayor a 0'),
  body('estado')
    .optional()
    .isIn(['Pendiente', 'Confirmada', 'Cancelada', 'Completada'])
    .withMessage('Estado inválido'),
  body('cantidadPersonas')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('La cantidad de personas debe estar entre 1 y 20'),
  handleValidationErrors
], async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: false,
        message: 'Reserva no encontrada'
      });
    }

    if (reservation.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para editar esta reserva'
      });
    }

    if (req.body.fechaInicio || req.body.fechaFin) {
      const newFechaInicio = req.body.fechaInicio ? new Date(req.body.fechaInicio) : reservation.fechaInicio;
      const newFechaFin = req.body.fechaFin ? new Date(req.body.fechaFin) : reservation.fechaFin;

      const isAvailable = await Reservation.checkAvailability(
        reservation.idPropiedad,
        newFechaInicio,
        newFechaFin,
        req.params.id
      );

      if (!isAvailable) {
        return res.status(400).json({
          status: false,
          message: 'La propiedad no está disponible en las nuevas fechas seleccionadas'
        });
      }
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'idPropiedad', select: 'titulo direccion' },
      { path: 'idUsuarioCreador', select: 'nombre apellido' }
    ]);

    res.json({
      status: true,
      message: 'Reserva actualizada exitosamente',
      value: updatedReservation
    });

  } catch (error) {
    console.error('Error actualizando reserva:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.put('/Cancelar/:id', [
  validateId,
  body('motivo')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('El motivo no puede exceder 500 caracteres'),
  handleValidationErrors
], async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: false,
        message: 'Reserva no encontrada'
      });
    }

    if (reservation.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para cancelar esta reserva'
      });
    }

    if (reservation.estado === 'Completada') {
      return res.status(400).json({
        status: false,
        message: 'No se pueden cancelar reservas completadas'
      });
    }

    await reservation.cancel(req.body.motivo);

    res.json({
      status: true,
      message: 'Reserva cancelada exitosamente',
      value: true
    });

  } catch (error) {
    console.error('Error cancelando reserva:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.put('/Confirmar/:id', validateId, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: false,
        message: 'Reserva no encontrada'
      });
    }

    if (reservation.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para confirmar esta reserva'
      });
    }

    await reservation.confirm();

    res.json({
      status: true,
      message: 'Reserva confirmada exitosamente',
      value: true
    });

  } catch (error) {
    console.error('Error confirmando reserva:', error);
    res.status(500).json({
      status: false,
      message: error.message || 'Error interno del servidor'
    });
  }
});

router.put('/Completar/:id', validateId, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        status: false,
        message: 'Reserva no encontrada'
      });
    }

    if (reservation.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para completar esta reserva'
      });
    }

    await reservation.complete();

    res.json({
      status: true,
      message: 'Reserva completada exitosamente',
      value: true
    });

  } catch (error) {
    console.error('Error completando reserva:', error);
    res.status(500).json({
      status: false,
      message: error.message || 'Error interno del servidor'
    });
  }
});

router.get('/FechasDisponibles/:propertyId', [
  validateId,
  query('startDate')
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),
  query('endDate')
    .isISO8601()
    .withMessage('Fecha de fin inválida')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.query.startDate)) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate } = req.query;

    const property = await Property.findOne({ _id: propertyId, activo: true });
    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    const availableDates = await Reservation.getAvailableDates(
      propertyId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      status: true,
      message: 'Fechas disponibles obtenidas exitosamente',
      value: availableDates
    });

  } catch (error) {
    console.error('Error obteniendo fechas disponibles:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.post('/AgregarPago/:reservationId', [
  validateId,
  body('monto')
    .isFloat({ min: 0 })
    .withMessage('El monto debe ser mayor a 0'),
  body('metodoPago')
    .notEmpty()
    .withMessage('El método de pago es requerido')
    .isIn(['Efectivo', 'Transferencia', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'PayPal', 'MercadoPago'])
    .withMessage('Método de pago inválido'),
  body('numeroTransaccion')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('El número de transacción no puede exceder 255 caracteres'),
  body('notasPago')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder 500 caracteres'),
  handleValidationErrors
], async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.reservationId);

    if (!reservation) {
      return res.status(404).json({
        status: false,
        message: 'Reserva no encontrada'
      });
    }

    if (reservation.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para agregar pagos a esta reserva'
      });
    }

    const paymentData = {
      monto: req.body.monto,
      metodoPago: req.body.metodoPago,
      estadoPago: 'Pagado',
      numeroTransaccion: req.body.numeroTransaccion,
      notasPago: req.body.notasPago
    };

    await reservation.addPayment(paymentData);

    res.json({
      status: true,
      message: 'Pago agregado exitosamente',
      value: reservation.pagos[reservation.pagos.length - 1]
    });

  } catch (error) {
    console.error('Error agregando pago:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

module.exports = router;