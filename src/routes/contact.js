const express = require('express');
const Contact = require('../models/Contact');
const { protect } = require('../middleware/auth');
const { validateContact, validateId } = require('../middleware/validation');
const { body, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const nodemailer = require('nodemailer');
const { body: bodyValidator } = require('express-validator');

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

router.post('/Enviar', validateContact, async (req, res) => {
  console.log('Datos recibidos:', req.body);
  try {
    const contactData = {
      ...req.body,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };
    const contact = new Contact(contactData);
    await contact.save();

    const mailOptions = {
      from: `"MKAlpini Inmobiliaria - Formulario de Contacto" <${process.env.EMAIL_FROM}>`,
      to: process.env.TASACION_EMAIL_TO,
      subject: `Nuevo mensaje de contacto desde la web de ${contactData.nombre || 'No proporcionado'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📌 Nombre:</strong> ${contactData.nombre || 'No proporcionado'}</p>
            <p><strong>✉️ Email:</strong> ${contactData.email || 'No proporcionado'}</p>
            <p><strong>📱 Teléfono:</strong> ${contactData.telefono || 'No proporcionado'}</p>
            <div style="margin-top: 15px; padding: 10px; background-color: #fff; border-left: 4px solid #4f46e5;">
              <p style="margin: 0;"><strong>Mensaje:</strong></p>
              <p style="white-space: pre-line; margin: 10px 0 0 0;">${contactData.mensaje || 'Sin mensaje'}</p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      status: true,
      message: 'Mensaje enviado exitosamente. Te responderemos pronto.',
      value: { idContacto: contact._id }
    });
  } catch (error) {
    console.error('Error enviando contacto:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/Obtener', [
  protect,
  query('estado').optional().isIn(['Nuevo', 'En_Proceso', 'Respondido', 'Cerrado']),
  query('tipo').optional().isIn(['General', 'Propiedad', 'Tasacion', 'Alquiler', 'Venta', 'Soporte']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { estado, tipo } = req.query;
    let queryOptions = {};
    if (estado) queryOptions.estado = estado;
    if (tipo) queryOptions.tipoConsulta = tipo;

    const contacts = await Contact.find(queryOptions)
      .populate('idPropiedadConsulta', 'titulo direccion precio')
      .populate('idUsuarioAsignado', 'nombre apellido')
      .sort({ fechaContacto: -1 });

    res.json({
      status: true,
      message: 'Contactos obtenidos exitosamente',
      value: contacts
    });
  } catch (error) {
    console.error('Error obteniendo contactos:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/Obtener/:id', [protect, validateId], async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('idPropiedadConsulta', 'titulo direccion precio imagenes')
      .populate('idUsuarioAsignado', 'nombre apellido correo');

    if (!contact) {
      return res.status(404).json({ status: false, message: 'Contacto no encontrado' });
    }
    res.json({ status: true, message: 'Contacto obtenido exitosamente', value: contact });
  } catch (error) {
    console.error('Error obteniendo contacto:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.put('/Responder/:id', [
  protect,
  validateId,
  body('respuesta').trim().isLength({ min: 10, max: 2000 }).withMessage('La respuesta debe tener entre 10 y 2000 caracteres'),
  handleValidationErrors
], async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ status: false, message: 'Contacto no encontrado' });
    }
    if (contact.estado === 'Cerrado') {
      return res.status(400).json({ status: false, message: 'No se puede responder un contacto cerrado' });
    }
    await contact.responder(req.body.respuesta, req.user._id);
    await contact.populate('idUsuarioAsignado', 'nombre apellido');
    res.json({ status: true, message: 'Respuesta enviada exitosamente', value: contact });
  } catch (error) {
    console.error('Error respondiendo contacto:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.put('/CambiarEstado/:id', [
  protect,
  validateId,
  body('estado').isIn(['Nuevo', 'En_Proceso', 'Respondido', 'Cerrado']).withMessage('Estado inválido'),
  handleValidationErrors
], async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ status: false, message: 'Contacto no encontrado' });
    }
    await contact.cambiarEstado(req.body.estado, req.user._id);
    await contact.populate('idUsuarioAsignado', 'nombre apellido');
    res.json({ status: true, message: 'Estado actualizado exitosamente', value: contact });
  } catch (error) {
    console.error('Error cambiando estado:', error);
    res.status(500).json({
      status: false,
      message: error.message || 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/Buscar', [
  protect,
  query('termino').optional().trim().isLength({ min: 2, max: 100 }),
  query('fechaDesde').optional().isISO8601(),
  query('fechaHasta').optional().isISO8601(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { termino, fechaDesde, fechaHasta } = req.query;
    let queryOptions = {};

    if (termino) {
      queryOptions.$text = { $search: termino };
    }
    if (fechaDesde || fechaHasta) {
      queryOptions.fechaContacto = {};
      if (fechaDesde) queryOptions.fechaContacto.$gte = new Date(fechaDesde);
      if (fechaHasta) queryOptions.fechaContacto.$lte = new Date(fechaHasta);
    }

    const contacts = await Contact.find(queryOptions)
      .populate('idPropiedadConsulta', 'titulo direccion')
      .populate('idUsuarioAsignado', 'nombre apellido')
      .sort({ fechaContacto: -1 });

    res.json({ status: true, message: `Se encontraron ${contacts.length} contactos`, value: contacts });
  } catch (error) {
    console.error('Error buscando contactos:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/Estadisticas', protect, async (req, res) => {
  try {
    const stats = await Contact.getEstadisticas();
    res.json({ status: true, message: 'Estadísticas obtenidas exitosamente', value: stats });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/Pendientes', protect, async (req, res) => {
  try {
    const contacts = await Contact.find({ estado: { $in: ['Nuevo', 'En_Proceso'] } })
      .populate('idPropiedadConsulta', 'titulo direccion')
      .populate('idUsuarioAsignado', 'nombre apellido')
      .sort({ fechaContacto: 1 });
    res.json({ status: true, message: 'Contactos pendientes obtenidos exitosamente', value: contacts });
  } catch (error) {
    console.error('Error obteniendo contactos pendientes:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.put('/MarcarLeido/:id', [protect, validateId], async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ status: false, message: 'Contacto no encontrado' });
    }
    if (contact.estado === 'Nuevo') {
      await contact.cambiarEstado('En_Proceso', req.user._id);
    }
    res.json({ status: true, message: 'Contacto marcado como leído', value: contact });
  } catch (error) {
    console.error('Error marcando como leído:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/EnviarConsultaPropiedad', validateContact, async (req, res) => {
  console.log('Datos recibidos para consulta de propiedad:', req.body);
  try {
    const { idPropiedad, tituloPropiedad, ...contactData } = req.body;

    const contact = new Contact({
      ...contactData,
      tipoConsulta: 'Propiedad',
      idPropiedadConsulta: idPropiedad,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    });

    await contact.save();

    const mailOptions = {
      from: `"MKAlpini Inmobiliaria - Consulta por Propiedad" <${process.env.EMAIL_FROM}>`,
      to: process.env.TASACION_EMAIL_TO,
      subject: `📌 Consulta por la propiedad: ${tituloPropiedad || 'Propiedad sin título'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #4f46e5; margin-top: 0;">Consulta por Propiedad</h2>
            <h3 style="margin-top: 0; color: #1f2937;">${tituloPropiedad || 'Propiedad sin título'}</h3>
            
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #4f46e5;">
              <p style="margin: 5px 0;"><strong>🔹 Propiedad:</strong> ${tituloPropiedad || 'No especificada'}</p>
              <p style="margin: 5px 0;"><strong>👤 Nombre:</strong> ${contactData.nombre || 'No proporcionado'}</p>
              <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${contactData.email || 'No proporcionado'}</p>
              <p style="margin: 5px 0;"><strong>📱 Teléfono:</strong> ${contactData.telefono || 'No proporcionado'}</p>
              <div style="margin-top: 15px; padding: 10px; background-color: #f3f4f6; border-radius: 4px;">
                <p style="margin: 0 0 5px 0; font-weight: 500;">Mensaje:</p>
                <p style="margin: 0; white-space: pre-line;">${contactData.mensaje || 'El contacto no dejó un mensaje.'}</p>
              </div>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin: 20px 0 0 0; padding-top: 15px; border-top: 1px solid #e5e7eb;">
              Este mensaje fue enviado desde el formulario de contacto de la propiedad en MKAlpini Inmobiliaria.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      status: true,
      message: 'Tu consulta ha sido enviada. Nos pondremos en contacto contigo pronto.',
      value: { idContacto: contact._id }
    });
  } catch (error) {
    console.error('Error enviando consulta de propiedad:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor al enviar la consulta',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.delete('/Eliminar/:id', [protect, validateId], async (req, res) => {
  try {
    if (req.user.idrol !== 3) {
      return res.status(403).json({ status: false, message: 'No tienes permisos para eliminar contactos' });
    }
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) {
      return res.status(404).json({ status: false, message: 'Contacto no encontrado' });
    }
    res.json({ status: true, message: 'Contacto eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando contacto:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint para consultas de alquiler temporal
router.post('/AlquilerTemporal', [
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('telefono').notEmpty().withMessage('El teléfono es requerido'),
  body('fechaEntrada').isISO8601().withMessage('Fecha de entrada inválida'),
  body('fechaSalida').isISO8601().withMessage('Fecha de salida inválida'),
  body('cantidadPersonas').isInt({ min: 1 }).withMessage('La cantidad de personas debe ser al menos 1'),
  handleValidationErrors
], async (req, res) => {
  console.log('Datos recibidos para alquiler temporal:', req.body);

  try {
    const { fechaEntrada, fechaSalida, cantidadPersonas, ...contactData } = req.body;

    // Validar que la fecha de entrada sea anterior a la de salida
    if (new Date(fechaEntrada) >= new Date(fechaSalida)) {
      return res.status(400).json({
        status: false,
        message: 'La fecha de entrada debe ser anterior a la fecha de salida'
      });
    }

    const alquilerData = {
      ...contactData,
      tipoConsulta: 'Alquiler',
      detallesAdicionales: {
        tipo: 'Temporal',
        fechaEntrada: new Date(fechaEntrada),
        fechaSalida: new Date(fechaSalida),
        cantidadPersonas: parseInt(cantidadPersonas)
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };

    const contact = new Contact(alquilerData);
    await contact.save();

    // Formatear fechas para el correo
    const formatoFecha = (fecha) => {
      return new Date(fecha).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const mailOptions = {
      from: `"MKAlpini Inmobiliaria - Consulta de Alquiler Temporal" <${process.env.EMAIL_FROM}>`,
      to: process.env.EMAIL_TO || process.env.EMAIL_USER,
      subject: `Consulta de alquiler temporal de ${contactData.nombre || 'Cliente'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Consulta de Alquiler Temporal</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Datos del Cliente</h3>
            <p><strong>👤 Nombre:</strong> ${contactData.nombre || 'No proporcionado'}</p>
            <p><strong>✉️ Email:</strong> ${contactData.email || 'No proporcionado'}</p>
            <p><strong>📱 Teléfono:</strong> ${contactData.telefono || 'No proporcionado'}</p>
            
            <h3 style="color: #374151; margin-top: 20px;">Detalles del Alquiler</h3>
            <p><strong>🏠 Fecha de Entrada:</strong> ${formatoFecha(fechaEntrada)}</p>
            <p><strong>🚪 Fecha de Salida:</strong> ${formatoFecha(fechaSalida)}</p>
            <p><strong>👥 Cantidad de Personas:</strong> ${cantidadPersonas}</p>
            
            ${contactData.mensaje ? `
            <div style="margin-top: 15px; padding: 10px; background-color: #fff; border-left: 4px solid #4f46e5;">
              <p style="margin: 0;"><strong>Mensaje adicional:</strong></p>
              <p style="white-space: pre-line; margin: 10px 0 0 0;">${contactData.mensaje}</p>
            </div>` : ''}
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      status: true,
      message: 'Solicitud de alquiler temporal enviada con éxito. Nos pondremos en contacto contigo pronto.',
      value: { idContacto: contact._id }
    });
  } catch (error) {
    console.error('Error procesando solicitud de alquiler temporal:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor al procesar la solicitud',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
