const express = require('express');
const Tasacion = require('../models/Tasacion');
const User = require('../models/User');
const { protect, optionalAuth } = require('../middleware/auth');
const { validateTasacion, validateId, handleValidationErrors } = require('../middleware/validation');
const { uploadTasacionImages, handleMulterError, getFileUrl } = require('../middleware/upload');
const { body, query } = require('express-validator');
const nodemailer = require('nodemailer');

const normalizePropertyType = (type = '') => {
  const map = {
    casa: 'Casa',
    departamento: 'Apartamento',
    apartamento: 'Apartamento',
    local: 'Local',
    terreno: 'Terreno',
    oficina: 'Oficina',
    depósito: 'Depósito',
    deposito: 'Depósito'
  };

  return map[type.toLowerCase()] || 'Casa';
};

let emailTransporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } catch (transportError) {
    console.error('No se pudo configurar el transporte de correo:', transportError);
    emailTransporter = null;
  }
} else {
  console.warn('Credenciales de correo no configuradas. Las notificaciones de tasaciones no se enviarán.');
}

const sendTasacionNotification = async (tasacion, payload, files = []) => {
  if (!emailTransporter) {
    return;
  }

  try {
    const contactoEmail = payload.correoContacto;
    const detallesHtml = `
      <h2>Nueva solicitud de tasación</h2>
      <h3>Datos de contacto</h3>
      <p><strong>Nombre:</strong> ${payload.nombreContacto}</p>
      <p><strong>Email:</strong> ${payload.correoContacto}</p>
      <p><strong>Teléfono:</strong> ${payload.telefonoContacto || 'No informado'}</p>
      <hr />
      <h3>Datos de la propiedad</h3>
      <p><strong>Dirección:</strong> ${tasacion.direccionPropiedad}</p>
      ${payload.barrioPropiedad ? `<p><strong>Barrio:</strong> ${payload.barrioPropiedad}</p>` : ''}
      ${payload.localidadPropiedad ? `<p><strong>Localidad:</strong> ${payload.localidadPropiedad}</p>` : ''}
      ${payload.provinciaPropiedad ? `<p><strong>Provincia:</strong> ${payload.provinciaPropiedad}</p>` : ''}
      <p><strong>Tipo:</strong> ${tasacion.tipoPropiedad}</p>
      <p><strong>Metros cuadrados:</strong> ${payload.metrosCuadrados || 'N/D'}</p>
      <p><strong>Habitaciones:</strong> ${payload.habitaciones || 'N/D'}</p>
      <p><strong>Baños:</strong> ${payload.banos || 'N/D'}</p>
      <p><strong>Antigüedad:</strong> ${payload.antiguedadAnios ? `${payload.antiguedadAnios} años` : 'N/D'}</p>
      <p><strong>Estado:</strong> ${payload.estadoPropiedad || 'N/D'}</p>
      <p><strong>Ubicación:</strong> ${payload.ubicacionTipo || 'N/D'}</p>
      <p><strong>Descripción:</strong> ${payload.descripcionPropiedad || 'Sin descripción adicional'}</p>
      <hr />
      ${files.length ? '<p><strong>Imágenes adjuntas:</strong> Sí</p>' : '<p><strong>Imágenes adjuntas:</strong> No</p>'}
    `;

    await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.TASACION_EMAIL_TO || 'mkalpinni@gmail.com',
      replyTo: contactoEmail,
      subject: `Nueva solicitud de tasación - ${tasacion.tituloPropiedad}`,
      html: detallesHtml,
      attachments: files.map((file) => ({
        filename: file.originalname,
        path: file.path,
        contentType: file.mimetype
      }))
    });
  } catch (emailError) {
    console.error('Error enviando email de tasación:', emailError);
  }
};

const parseNumericField = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const router = express.Router();

router.post('/Crear', [
  uploadTasacionImages,
  handleMulterError,
  body('direccion').trim().isLength({ min: 5, max: 500 }).withMessage('La dirección debe tener entre 5 y 500 caracteres'),
  body('barrioPropiedad').trim().notEmpty().withMessage('El barrio es requerido').isLength({ max: 100 }).withMessage('El barrio no puede exceder 100 caracteres'),
  body('localidadPropiedad').trim().notEmpty().withMessage('La localidad es requerida').isLength({ max: 100 }).withMessage('La localidad no puede exceder 100 caracteres'),
  body('provinciaPropiedad').trim().notEmpty().withMessage('La provincia es requerida').isLength({ max: 100 }).withMessage('La provincia no puede exceder 100 caracteres'),
  body('tipoPropiedad').notEmpty().withMessage('El tipo de propiedad es requerido').isString().isLength({ min: 3, max: 50 }).withMessage('Tipo de propiedad inválido'),
  body('ubicacionTipo').notEmpty().withMessage('La ubicación del inmueble es requerida').isString().isLength({ max: 100 }).withMessage('La ubicación no puede exceder 100 caracteres'),
  body('metrosCuadrados').notEmpty().withMessage('Los metros cuadrados son requeridos').isFloat({ min: 0.01, max: 10000 }).withMessage('Los metros cuadrados deben ser mayores a 0 y menores a 10000'),
  body('habitaciones').notEmpty().withMessage('Las habitaciones son requeridas').isInt({ min: 0, max: 20 }).withMessage('Las habitaciones deben ser un número entre 0 y 20'),
  body('banos').notEmpty().withMessage('Los baños son requeridos').isInt({ min: 0, max: 10 }).withMessage('Los baños deben ser un número entre 0 y 10'),
  body('antiguedadAnios').notEmpty().withMessage('La antigüedad es requerida').isInt({ min: 0, max: 200 }).withMessage('La antigüedad debe estar entre 0 y 200 años'),
  body('estadoPropiedad').trim().notEmpty().withMessage('El estado de la propiedad es requerido').isLength({ max: 100 }).withMessage('El estado no puede exceder 100 caracteres'),
  body('descripcionPropiedad').trim().notEmpty().withMessage('La descripción es requerida').isLength({ max: 2000 }).withMessage('La descripción no puede exceder 2000 caracteres'),
  body('nombreContacto').trim().isLength({ min: 2, max: 255 }).withMessage('El nombre debe tener entre 2 y 255 caracteres'),
  body('telefonoContacto').trim().notEmpty().withMessage('El teléfono es requerido').isLength({ min: 6, max: 20 }).withMessage('El teléfono debe tener entre 6 y 20 caracteres'),
  body('correoContacto').isEmail().normalizeEmail().withMessage('Debe ser un correo electrónico válido'),
  handleValidationErrors
], async (req, res) => {
  try {
    const adminUser = await User.findOne({ idrol: 3, activo: true });

    if (!adminUser) {
      return res.status(400).json({
        status: false,
        message: 'No hay administradores disponibles para asignar la tasación'
      });
    }

    const direccion = req.body.direccion.trim();
    const tipoPropiedad = normalizePropertyType(req.body.tipoPropiedad);
    const metrosCuadrados = parseNumericField(req.body.metrosCuadrados);
    const habitaciones = parseNumericField(req.body.habitaciones);
    const banos = parseNumericField(req.body.banos);
    const antiguedad = parseNumericField(req.body.antiguedadAnios);

    const descripcion = req.body.descripcionPropiedad?.trim();
    const tituloPropiedad = descripcion && descripcion.length >= 5
      ? descripcion.substring(0, 255)
      : `Tasación de ${tipoPropiedad} en ${direccion}`;

    const detalles = [
      descripcion ? `Descripción: ${descripcion}` : null,
      req.body.estadoPropiedad ? `Estado: ${req.body.estadoPropiedad}` : null,
      req.body.ubicacionTipo ? `Ubicación: ${req.body.ubicacionTipo}` : null,
      Number.isFinite(antiguedad) ? `Antigüedad: ${antiguedad} años` : null
    ].filter(Boolean).join('\n');

    const tasacionData = {
      tituloPropiedad,
      direccionPropiedad: direccion,
      tipoPropiedad,
      superficieM2: metrosCuadrados,
      habitaciones,
      banos,
      nombreSolicitante: req.body.nombreContacto,
      emailSolicitante: req.body.correoContacto.toLowerCase(),
      telefonoSolicitante: req.body.telefonoContacto,
      estado: 'Pendiente',
      fechaSolicitud: new Date(),
      idUsuarioAsignado: adminUser._id,
      barrioPropiedad: req.body.barrioPropiedad?.trim() || undefined,
      localidadPropiedad: req.body.localidadPropiedad?.trim() || undefined,
      provinciaPropiedad: req.body.provinciaPropiedad?.trim() || undefined,
      detallesTasacion: detalles || undefined,
      observaciones: descripcion
    };

    if (Number.isFinite(antiguedad)) {
      tasacionData.antiguedadAnios = antiguedad;
    }

    const tasacion = new Tasacion(tasacionData);
    await tasacion.save();

    await sendTasacionNotification(tasacion, req.body, req.files);

    res.json({
      status: true,
      message: '¡Gracias! Tu solicitud de tasación fue enviada correctamente. Nos comunicaremos contigo a la brevedad.',
      value: {
        idTasacion: tasacion.idTasacion
      }
    });

  } catch (error) {
    console.error('Error creando solicitud de tasación:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.post('/Solicitar', validateTasacion, async (req, res) => {
  try {
    const adminUser = await User.findOne({ idrol: 3, activo: true });

    if (!adminUser) {
      return res.status(400).json({
        status: false,
        message: 'No hay administradores disponibles para asignar la tasación'
      });
    }

    const tasacionData = {
      ...req.body,
      estado: 'Pendiente',
      fechaSolicitud: new Date(),
      idUsuarioAsignado: adminUser._id
    };

    const tasacion = new Tasacion(tasacionData);
    await tasacion.save();

    res.json({
      status: true,
      message: 'Solicitud de tasación enviada exitosamente. Te contactaremos pronto.',
      value: tasacion.idTasacion
    });

  } catch (error) {
    console.error('Error solicitando tasación:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/Obtener', [
  protect,
  query('estado')
    .optional()
    .isIn(['Pendiente', 'En_Proceso', 'Completada', 'Cancelada'])
    .withMessage('Estado inválido'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { estado } = req.query;

    let query = {};
    if (estado) query.estado = estado;

    const tasaciones = await Tasacion.find(query)
      .populate('idPropiedad', 'titulo direccion precio')
      .populate('idCliente', 'nombreCompleto email telefono')
      .populate('idUsuarioAsignado', 'nombre apellido')
      .populate('idUsuarioCreador', 'nombre apellido')
      .sort({ fechaCreacion: -1 });

    res.json({
      status: true,
      message: 'Tasaciones obtenidas exitosamente',
      value: tasaciones
    });

  } catch (error) {
    console.error('Error obteniendo tasaciones:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/Obtener/:id', [protect, validateId], async (req, res) => {
  try {
    const tasacion = await Tasacion.findById(req.params.id)
      .populate({
        path: 'idPropiedad',
        populate: {
          path: 'imagenes'
        }
      })
      .populate('idCliente')
      .populate('idUsuarioAsignado', 'nombre apellido correo')
      .populate('idUsuarioCreador', 'nombre apellido');

    if (!tasacion) {
      return res.status(404).json({
        status: false,
        message: 'Tasación no encontrada'
      });
    }

    res.json({
      status: true,
      message: 'Tasación obtenida exitosamente',
      value: tasacion
    });

  } catch (error) {
    console.error('Error obteniendo tasación:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.put('/Actualizar/:id', [
  protect,
  validateId,
  body('estado')
    .optional()
    .isIn(['Pendiente', 'En_Proceso', 'Completada', 'Cancelada'])
    .withMessage('Estado inválido'),
  body('valorEstimado')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor estimado debe ser mayor a 0'),
  body('valorMinimo')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor mínimo debe ser mayor a 0'),
  body('valorMaximo')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor máximo debe ser mayor a 0'),
  body('observaciones')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Las observaciones no pueden exceder 1000 caracteres'),
  body('detallesTasacion')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Los detalles no pueden exceder 2000 caracteres'),
  body('fechaVisita')
    .optional()
    .isISO8601()
    .toDate(),
  handleValidationErrors
], async (req, res) => {
  try {
    const tasacion = await Tasacion.findById(req.params.id);

    if (!tasacion) {
      return res.status(404).json({
        status: false,
        message: 'Tasación no encontrada'
      });
    }

    if (tasacion.idUsuarioAsignado.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para actualizar esta tasación'
      });
    }

    const { valorMinimo, valorMaximo, valorEstimado } = req.body;

    if (valorMinimo && valorMaximo && valorMaximo <= valorMinimo) {
      return res.status(400).json({
        status: false,
        message: 'El valor máximo debe ser mayor que el valor mínimo'
      });
    }

    if (valorEstimado && valorMinimo && valorMaximo) {
      if (valorEstimado < valorMinimo || valorEstimado > valorMaximo) {
        return res.status(400).json({
          status: false,
          message: 'El valor estimado debe estar entre el valor mínimo y máximo'
        });
      }
    }

    const updatedTasacion = await Tasacion.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        idUsuarioCreador: req.user._id
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'idPropiedad', select: 'titulo direccion' },
      { path: 'idCliente', select: 'nombreCompleto email' },
      { path: 'idUsuarioAsignado', select: 'nombre apellido' }
    ]);

    res.json({
      status: true,
      message: 'Tasación actualizada exitosamente',
      value: updatedTasacion
    });

  } catch (error) {
    console.error('Error actualizando tasación:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.put('/ProgramarVisita/:id', [
  protect,
  validateId,
  body('fechaVisita')
    .isISO8601()
    .toDate()
    .custom((value) => {
      const now = new Date();
      if (value <= now) {
        throw new Error('La fecha de visita debe ser en el futuro');
      }
      return true;
    }),
  handleValidationErrors
], async (req, res) => {
  try {
    const tasacion = await Tasacion.findById(req.params.id);

    if (!tasacion) {
      return res.status(404).json({
        status: false,
        message: 'Tasación no encontrada'
      });
    }

    if (tasacion.idUsuarioAsignado.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para programar visitas para esta tasación'
      });
    }

    await tasacion.programarVisita(new Date(req.body.fechaVisita));

    res.json({
      status: true,
      message: 'Visita programada exitosamente',
      value: {
        fechaVisita: tasacion.fechaVisita,
        estado: tasacion.estado
      }
    });

  } catch (error) {
    console.error('Error programando visita:', error);
    res.status(500).json({
      status: false,
      message: error.message || 'Error interno del servidor'
    });
  }
});

router.post('/SubirImagenes/:id', [
  protect,
  validateId,
  uploadTasacionImages,
  handleMulterError
], async (req, res) => {
  try {
    const tasacion = await Tasacion.findById(req.params.id);

    if (!tasacion) {
      return res.status(404).json({
        status: false,
        message: 'Tasación no encontrada'
      });
    }

    if (tasacion.idUsuarioAsignado.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para subir imágenes a esta tasación'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: false,
        message: 'No se recibieron archivos'
      });
    }

    const uploadedImages = [];

    for (const file of req.files) {
      const imagenData = {
        rutaArchivo: `tasaciones/${req.params.id}/${file.filename}`,
        nombreArchivo: file.originalname
      };

      await tasacion.agregarImagen(imagenData);
      uploadedImages.push(getFileUrl(req, imagenData.rutaArchivo));
    }

    res.json({
      status: true,
      message: `Se subieron ${uploadedImages.length} imágenes exitosamente`,
      imagenes: uploadedImages
    });

  } catch (error) {
    console.error('Error subiendo imágenes:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/MisTasaciones', protect, async (req, res) => {
  try {
    const tasaciones = await Tasacion.find({ idUsuarioAsignado: req.user._id })
      .populate('idPropiedad', 'titulo direccion')
      .populate('idCliente', 'nombreCompleto email')
      .sort({ fechaCreacion: -1 });

    res.json({
      status: true,
      message: 'Tasaciones asignadas obtenidas exitosamente',
      value: tasaciones
    });

  } catch (error) {
    console.error('Error obteniendo tasaciones del usuario:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/Buscar', [
  protect,
  query('termino')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El término de búsqueda debe tener entre 2 y 100 caracteres'),
  query('tipoPropiedad')
    .optional()
    .isIn(['Casa', 'Apartamento', 'Local', 'Terreno', 'Oficina', 'Depósito'])
    .withMessage('Tipo de propiedad inválido'),
  query('valorMin')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor mínimo debe ser mayor a 0'),
  query('valorMax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor máximo debe ser mayor a 0'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { termino, tipoPropiedad, valorMin, valorMax } = req.query;

    let query = {};

    if (termino) {
      query.$text = { $search: termino };
    }

    if (tipoPropiedad) {
      query.tipoPropiedad = tipoPropiedad;
    }

    if (valorMin || valorMax) {
      query.valorEstimado = {};
      if (valorMin) query.valorEstimado.$gte = Number(valorMin);
      if (valorMax) query.valorEstimado.$lte = Number(valorMax);
    }

    const tasaciones = await Tasacion.find(query)
      .populate('idPropiedad', 'titulo direccion')
      .populate('idCliente', 'nombreCompleto email')
      .populate('idUsuarioAsignado', 'nombre apellido')
      .sort({ fechaCreacion: -1 });

    res.json({
      status: true,
      message: `Se encontraron ${tasaciones.length} tasaciones`,
      value: tasaciones
    });

  } catch (error) {
    console.error('Error buscando tasaciones:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/Estadisticas', protect, async (req, res) => {
  try {
    const stats = await Tasacion.getEstadisticas();

    res.json({
      status: true,
      message: 'Estadísticas obtenidas exitosamente',
      value: stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.put('/Cancelar/:id', [
  protect,
  validateId,
  body('motivo')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('El motivo no puede exceder 500 caracteres'),
  handleValidationErrors
], async (req, res) => {
  try {
    const tasacion = await Tasacion.findById(req.params.id);

    if (!tasacion) {
      return res.status(404).json({
        status: false,
        message: 'Tasación no encontrada'
      });
    }

    if (tasacion.idUsuarioAsignado.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para cancelar esta tasación'
      });
    }

    if (tasacion.estado === 'Completada') {
      return res.status(400).json({
        status: false,
        message: 'No se pueden cancelar tasaciones completadas'
      });
    }

    tasacion.estado = 'Cancelada';
    if (req.body.motivo) {
      const motivoTexto = `Cancelada: ${req.body.motivo}`;
      tasacion.observaciones = tasacion.observaciones ?
        `${tasacion.observaciones}\n${motivoTexto}` :
        motivoTexto;
    }

    await tasacion.save();

    res.json({
      status: true,
      message: 'Tasación cancelada exitosamente',
      value: tasacion
    });

  } catch (error) {
    console.error('Error cancelando tasación:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.delete('/Eliminar/:id', [protect, validateId], async (req, res) => {
  try {
    if (req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para eliminar tasaciones'
      });
    }

    const tasacion = await Tasacion.findByIdAndDelete(req.params.id);

    if (!tasacion) {
      return res.status(404).json({
        status: false,
        message: 'Tasación no encontrada'
      });
    }

    res.json({
      status: true,
      message: 'Tasación eliminada exitosamente',
      value: true
    });

  } catch (error) {
    console.error('Error eliminando tasación:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

module.exports = router;