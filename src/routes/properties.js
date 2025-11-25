const express = require('express');
const mongoose = require('mongoose');
const Property = require('../models/Property');
const Favorite = require('../models/Favorite');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const { validateProperty, validateId, validateSearch } = require('../middleware/validation');
const { uploadPropertyImages, handleMulterError, deleteFile } = require('../middleware/upload');
const { geocodeAddress } = require('../utils/geocoding');

const router = express.Router();
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Request Params:', req.params);
  console.log('Request Query:', req.query);
  next();
});

router.get('/Obtener', optionalAuth, async (req, res) => {
  try {
    let properties = await Property.find({ activo: true })
      .populate('idUsuarioCreador', 'nombre apellido correo')
      .sort({ fechaCreacion: -1 })
      .lean();

    if (req.user) {
      properties = await Favorite.addFavoriteStatus(properties, req.user._id);
    }

    res.json({
      status: true,
      message: 'Propiedades obtenidas exitosamente',
      value: properties
    });

  } catch (error) {
    console.error('Error obteniendo propiedades:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/Obtener/:id', [validateId, optionalAuth], async (req, res) => {
  try {
    let property = await Property.findOne({ _id: req.params.id, activo: true })
      .populate('idUsuarioCreador', 'nombre apellido correo')
      .lean();

    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    if (req.user) {
      const properties = await Favorite.addFavoriteStatus([property], req.user._id);
      property = properties[0];
    }

    res.json({
      status: true,
      message: 'Propiedad obtenida exitosamente',
      value: property
    });

  } catch (error) {
    console.error('Error obteniendo propiedad:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/Buscar', [validateSearch, optionalAuth], async (req, res) => {
  try {
    const filters = {
      transaccionTipo: req.query.transaccionTipo,
      tipoPropiedad: req.query.tipoPropiedad,
      barrio: req.query.barrio,
      ubicacion: req.query.ubicacion,
      precioMin: req.query.precioMin,
      precioMax: req.query.precioMax,
      habitacionesMin: req.query.habitacionesMin,
      banosMin: req.query.banosMin,
      superficieMin: req.query.superficieMin,
      superficieMax: req.query.superficieMax,
      estado: req.query.estado,
      esAlquilerTemporario: req.query.esAlquilerTemporario
    };

    let properties = await Property.searchProperties(filters).lean();

    if (req.user) {
      properties = await Favorite.addFavoriteStatus(properties, req.user._id);
    }

    res.json({
      status: true,
      message: `Se encontraron ${properties.length} propiedades`,
      value: properties
    });

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.post('/Crear', [protect, validateProperty], async (req, res) => {
  try {
    const propertyData = {
      ...req.body,
      idUsuarioCreador: req.user._id
    };

    if ((!propertyData.latitud || !propertyData.longitud) && (propertyData.direccion || propertyData.barrio || propertyData.localidad || propertyData.provincia)) {
      const geocoded = await geocodeAddress(propertyData);
      if (geocoded) {
        propertyData.latitud = geocoded.latitud;
        propertyData.longitud = geocoded.longitud;
      }
    }

    if (typeof propertyData.servicios === 'string') {
      try {
        propertyData.servicios = JSON.parse(propertyData.servicios);
      } catch {
        propertyData.servicios = propertyData.servicios.split(',').map(s => s.trim());
      }
    }

    if (typeof propertyData.reglasPropiedad === 'string') {
      try {
        propertyData.reglasPropiedad = JSON.parse(propertyData.reglasPropiedad);
      } catch {
        propertyData.reglasPropiedad = propertyData.reglasPropiedad.split(',').map(r => r.trim());
      }
    }

    if (typeof propertyData.metodosPago === 'string') {
      try {
        propertyData.metodosPago = JSON.parse(propertyData.metodosPago);
      } catch {
        propertyData.metodosPago = propertyData.metodosPago.split(',').map(m => m.trim());
      }
    }
    propertyData.imagenes = [];

    const property = new Property(propertyData);
    await property.save();

    await property.populate('idUsuarioCreador', 'nombre apellido correo');

    res.status(201).json({
      status: true,
      message: 'Propiedad creada exitosamente',
      value: property
    });

  } catch (error) {
    console.error('Error creando propiedad:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/Disponibilidad/:id', [validateId, optionalAuth], async (req, res) => {
  console.log('GET /Disponibilidad/:id - Params:', req.params);
  try {
    const property = await Property.findOne({ _id: req.params.id, activo: true })
      .select('disponibilidad estado')
      .lean();

    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    const responseProperty = {
      ...property,
      availability: property.disponibilidad || []
    };

    res.json({
      status: true,
      message: 'Disponibilidad obtenida correctamente',
      value: responseProperty
    });
  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

const normalizeEstado = (estado) => {
  if (!estado) return 'Disponible';
  if (['Disponible', 'Reservado', 'Ocupado', 'Vendido'].includes(estado)) {
    return estado;
  }
  const estadoLower = String(estado).toLowerCase();
  if (estadoLower === 'disponible') return 'Disponible';
  if (estadoLower === 'reservado' || estadoLower === 'reservado_temp') return 'Reservado';
  if (estadoLower === 'ocupado' || estadoLower === 'ocupado_temp') return 'Ocupado';
  return 'Disponible';
};

const normalizeStatus = (statusValue) => {
  if (!statusValue) return 'disponible';
  const statusLower = String(statusValue).toLowerCase();
  if (statusLower === 'disponible') return 'disponible';
  if (statusLower === 'reservado' || statusLower === 'reservado_temp') return 'reservado_temp';
  if (statusLower === 'ocupado' || statusLower === 'ocupado_temp') return 'ocupado_temp';
  return 'disponible';
};

const handleDisponibilidadUpdate = async (req, res) => {
  console.log(`=== DISPONIBILidad ${req.method} REQUEST ===`);
  console.log('Params:', req.params);
  console.log('Body:', req.body);
  try {
    const { startDate, endDate, status, clientName, deposit, guests } = req.body;

    if (!startDate || !endDate || !status) {
      return res.status(400).json({
        status: false,
        message: 'Faltan campos requeridos: startDate, endDate, status'
      });
    }

    const property = await Property.findOne({ _id: req.params.id, activo: true });
    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    if (property.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para actualizar esta propiedad'
      });
    }

    console.log('Estado original de la propiedad:', property.estado);
    property.estado = normalizeEstado(property.estado);
    console.log('Estado después de normalización inicial:', property.estado);

    if (!property.disponibilidad || !Array.isArray(property.disponibilidad)) {
      property.disponibilidad = [];
    }

    const disponibilidadArray = property.disponibilidad;

    const normalizedStatus = normalizeStatus(status);

    const newRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: normalizedStatus,
      clientName: clientName || '',
      deposit: parseFloat(deposit) || 0,
      guests: parseInt(guests) || 1,
      id: `range-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    if (isNaN(newRange.startDate.getTime()) || isNaN(newRange.endDate.getTime())) {
      return res.status(400).json({
        status: false,
        message: 'Fechas inválidas'
      });
    }

    if (newRange.startDate >= newRange.endDate) {
      return res.status(400).json({
        status: false,
        message: 'La fecha de inicio debe ser anterior a la fecha de fin'
      });
    }

    const finalAvailabilityRanges = [];
    let conflictError = null;

    const bookingStart = newRange.startDate;
    const bookingEnd = newRange.endDate;
    const createSplitRange = (originalRange, startDate, endDate, suffix) => {
      const newSplitRange = {
        ...originalRange,
        startDate: startDate,
        endDate: endDate,
        id: `range-${Date.now()}-split-${suffix}-${Math.random().toString(36).substr(2, 9)}`
      };
      delete newSplitRange._id;
      return newSplitRange;
    };


    if (normalizedStatus === 'disponible') {
      const hasConflict = disponibilidadArray.some(range => {
        if (!range || !range.startDate || !range.endDate) return false;
        const rangeStart = new Date(range.startDate);
        const rangeEnd = new Date(range.endDate);
        const rangeStatus = String(range.status || '').toLowerCase();
        const overlaps = bookingStart <= rangeEnd && bookingEnd >= rangeStart;
        return overlaps && (rangeStatus === 'ocupado_temp' || rangeStatus === 'reservado_temp');
      });

      if (hasConflict) {
        conflictError = {
          status: 400,
          message: 'Error: No puede marcar un rango como "disponible" si este contiene días que ya están reservados u ocupados.'
        };
      } else {
        finalAvailabilityRanges.push(...disponibilidadArray, newRange);
      }

    } else if (normalizedStatus === 'reservado_temp') {
      let hasConflict = false;
      disponibilidadArray.forEach(range => {
        if (!range || !range.startDate || !range.endDate) {
          if (range) finalAvailabilityRanges.push(range);
          return;
        }
        const rangeStart = new Date(range.startDate);
        const rangeEnd = new Date(range.endDate);
        const rangeStatus = String(range.status || '').toLowerCase();
        const overlaps = bookingStart <= rangeEnd && bookingEnd >= rangeStart;

        if (!overlaps) {
          finalAvailabilityRanges.push(range);
          return;
        }

        if (rangeStatus === 'ocupado_temp' || rangeStatus === 'reservado_temp') {
          hasConflict = true;
          finalAvailabilityRanges.push(range);
        }
        else if (rangeStatus === 'disponible') {
          const originalRangeObject = range.toObject ? range.toObject() : { ...range };
          if (rangeStart < bookingStart) {
            finalAvailabilityRanges.push(createSplitRange(originalRangeObject, rangeStart, new Date(bookingStart.getTime() - 1), 'before'));
          }
          if (rangeEnd > bookingEnd) {
            finalAvailabilityRanges.push(createSplitRange(originalRangeObject, new Date(bookingEnd.getTime() + 1), rangeEnd, 'after'));
          }
        } else {
          finalAvailabilityRanges.push(range);
        }
      });

      if (hasConflict) {
        conflictError = {
          status: 400,
          message: 'El rango de fechas se superpone con otro existente que ya está reservado u ocupado'
        };
      } else {
        finalAvailabilityRanges.push(newRange);
      }

    } else if (normalizedStatus === 'ocupado_temp') {
      let hasConflict = false;
      disponibilidadArray.forEach(range => {
        if (!range || !range.startDate || !range.endDate) {
          if (range) finalAvailabilityRanges.push(range);
          return;
        }
        const rangeStart = new Date(range.startDate);
        const rangeEnd = new Date(range.endDate);
        const rangeStatus = String(range.status || '').toLowerCase();
        const overlaps = bookingStart <= rangeEnd && bookingEnd >= rangeStart;

        if (!overlaps) {
          finalAvailabilityRanges.push(range);
          return;
        }

        if (rangeStatus === 'ocupado_temp') {
          hasConflict = true;
          finalAvailabilityRanges.push(range);
        }
        else if (rangeStatus === 'disponible' || rangeStatus === 'reservado_temp') {
          const originalRangeObject = range.toObject ? range.toObject() : { ...range };
          if (rangeStart < bookingStart) {
            finalAvailabilityRanges.push(createSplitRange(originalRangeObject, rangeStart, new Date(bookingStart.getTime() - 1), 'before'));
          }
          if (rangeEnd > bookingEnd) {
            finalAvailabilityRanges.push(createSplitRange(originalRangeObject, new Date(bookingEnd.getTime() + 1), rangeEnd, 'after'));
          }
        } else {
          finalAvailabilityRanges.push(range);
        }
      });

      if (hasConflict) {
        conflictError = {
          status: 400,
          message: 'El rango de fechas se superpone con otro existente que ya está ocupado'
        };
      } else {
        finalAvailabilityRanges.push(newRange);
      }
    }

    if (conflictError) {
      return res.status(conflictError.status).json({
        status: false,
        message: conflictError.message
      });
    }

    property.disponibilidad = finalAvailabilityRanges;
    console.log('Status recibido:', status);
    console.log('Status normalizado:', normalizedStatus);

    if (normalizedStatus === 'ocupado_temp') {
      property.estado = 'Ocupado';
    } else if (normalizedStatus === 'reservado_temp') {
      property.estado = 'Reservado';
    } else if (normalizedStatus === 'disponible') {
      const hasBookedRanges = property.disponibilidad.some(r =>
        r && ['ocupado_temp', 'reservado_temp'].includes(String(r.status || '').toLowerCase())
      );

      if (!hasBookedRanges) {
        property.estado = 'Disponible';
      }
      else {
        const hasOcupado = property.disponibilidad.some(r => r && String(r.status || '').toLowerCase() === 'ocupado_temp');
        property.estado = hasOcupado ? 'Ocupado' : 'Reservado';
      }
    }

    console.log('Estado antes de normalización final:', property.estado);
    property.estado = normalizeEstado(property.estado);
    console.log('Estado después de normalización final:', property.estado);
    console.log('Tipo de estado:', typeof property.estado);
    console.log('Estado es válido?', ['Disponible', 'Reservado', 'Ocupado', 'Vendido'].includes(property.estado));

    if (!['Disponible', 'Reservado', 'Ocupado', 'Vendido'].includes(property.estado)) {
      console.error('ERROR: Estado inválido detectado, forzando a Disponible');
      property.estado = 'Disponible';
    }

    const updateData = {
      disponibilidad: property.disponibilidad,
      estado: property.estado
    };

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: false }
    ).populate('idUsuarioCreador', 'nombre apellido correo');

    if (!updatedProperty) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada después de actualizar'
      });
    }

    if (!['Disponible', 'Reservado', 'Ocupado', 'Vendido'].includes(updatedProperty.estado)) {
      updatedProperty.estado = normalizeEstado(updatedProperty.estado);
      await Property.findByIdAndUpdate(
        req.params.id,
        { $set: { estado: updatedProperty.estado } },
        { runValidators: false }
      );
    }

    const finalProperty = await Property.findById(req.params.id)
      .populate('idUsuarioCreador', 'nombre apellido correo');

    const responseProperty = finalProperty.toObject();
    responseProperty.availability = responseProperty.disponibilidad || [];

    res.json({
      status: true,
      message: 'Disponibilidad actualizada correctamente',
      value: responseProperty
    });

  } catch (error) {
    console.error('Error actualizando disponibilidad:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.errors) {
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: false,
        message: 'Error de validación',
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          errors: Object.keys(error.errors).map(key => ({
            field: key,
            message: error.errors[key].message,
            value: error.errors[key].value
          }))
        } : 'Error de validación'
      });
    }
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
};

router.put('/Disponibilidad/:id', [protect, validateId], handleDisponibilidadUpdate);
router.patch('/Disponibilidad/:id', [protect, validateId], handleDisponibilidadUpdate);

router.delete('/Disponibilidad/:id/date/:date', [protect, validateId], async (req, res) => {
  console.log('DELETE /Disponibilidad/:id/date/:date - Params:', req.params);
  try {
    const { id, date } = req.params;
    const property = await Property.findOne({ _id: id, activo: true });

    if (!property) {
      return res.status(404).json({ status: false, message: 'Propiedad no encontrada' });
    }
    if (property.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para actualizar esta propiedad'
      });
    }

    const targetDayStart = new Date(date + 'T00:00:00');
    const targetDayEnd = new Date(date + 'T23:59:59.999');

    console.log('Buscando día (local server time):', targetDayStart.toISOString(), 'a', targetDayEnd.toISOString());

    if (isNaN(targetDayStart.getTime())) {
      return res.status(400).json({ status: false, message: 'Formato de fecha inválido. Use YYYY-MM-DD' });
    }

    const rangeIndex = property.disponibilidad.findIndex(range => {
      if (!range.startDate || !range.endDate) return false;

      const rangeStart = new Date(range.startDate);
      const rangeEnd = new Date(range.endDate);

      const overlaps = (rangeStart <= targetDayEnd) && (rangeEnd >= targetDayStart);

      return overlaps;
    });

    if (rangeIndex === -1) {
      console.log('No se encontró rango para las fechas:', targetDayStart.toISOString(), targetDayEnd.toISOString());
      return res.status(404).json({
        status: false,
        message: 'No se encontró un rango que contenga la fecha especificada'
      });
    }

    console.log('Rango encontrado para dividir:', property.disponibilidad[rangeIndex]);

    const originalRange = property.disponibilidad[rangeIndex].toObject();
    const originalStatus = String(originalRange.status || 'disponible').toLowerCase();

    const rangeStart = new Date(originalRange.startDate);
    const rangeEnd = new Date(originalRange.endDate);

    property.disponibilidad.splice(rangeIndex, 1);

    if (rangeStart < targetDayStart) {
      const beforeRange = {
        ...originalRange,
        _id: new mongoose.Types.ObjectId(),
        endDate: new Date(targetDayStart.getTime() - 1),
        id: `${originalRange.id || 'range'}-split-before`
      };
      console.log('Creando rango ANTES:', beforeRange.startDate, beforeRange.endDate);
      property.disponibilidad.push(beforeRange);
    }

    if (rangeEnd > targetDayEnd) {
      const afterRange = {
        ...originalRange,
        _id: new mongoose.Types.ObjectId(),
        startDate: new Date(targetDayEnd.getTime() + 1),
        id: `${originalRange.id || 'range'}-split-after`
      };
      console.log('Creando rango DESPUÉS:', afterRange.startDate, afterRange.endDate);
      property.disponibilidad.push(afterRange);
    }

    if (originalStatus === 'reservado_temp' || originalStatus === 'ocupado_temp') {
      const newAvailableRange = {
        startDate: targetDayStart,
        endDate: targetDayEnd,
        status: 'disponible',
        clientName: '',
        deposit: 0,
        guests: 1,
        id: `range-${Date.now()}-made-available`
      };
      console.log('Marcando día como DISPONIBLE:', newAvailableRange.startDate, newAvailableRange.endDate);
      property.disponibilidad.push(newAvailableRange);
    }

    await property.save();

    const finalProperty = await Property.findById(id).populate('idUsuarioCreador', 'nombre apellido correo');

    const responseProperty = finalProperty.toObject();
    responseProperty.availability = responseProperty.disponibilidad || [];

    res.json({
      status: true,
      message: 'Fecha actualizada correctamente',
      value: responseProperty
    });
  } catch (error) {
    console.error('Error eliminando/actualizando fecha de disponibilidad:', error);
    res.status(500).json({
      status: false,
      message: 'Error al procesar la solicitud de fecha',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.delete('/Disponibilidad/:id/:rangeId', [protect, validateId], async (req, res) => {
  console.log('DELETE /Disponibilidad/:id/:rangeId - Params:', req.params);
  try {
    const property = await Property.findOne({ _id: req.params.id, activo: true });
    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    if (property.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para actualizar esta propiedad'
      });
    }

    if (!property.disponibilidad || !Array.isArray(property.disponibilidad)) {
      property.disponibilidad = [];
    }

    const initialLength = property.disponibilidad.length;
    property.disponibilidad = property.disponibilidad.filter(
      range => range.id !== req.params.rangeId && range._id?.toString() !== req.params.rangeId
    );

    if (property.disponibilidad.length === initialLength) {
      return res.status(404).json({
        status: false,
        message: 'Rango de disponibilidad no encontrado'
      });
    }

    const hasBookedRanges = property.disponibilidad.some(range =>
      ['ocupado_temp', 'reservado_temp'].includes(range.status)
    );

    if (!hasBookedRanges) {
      property.estado = 'Disponible';
    }

    await property.save();

    const responseProperty = property.toObject();
    responseProperty.availability = responseProperty.disponibilidad || [];

    res.json({
      status: true,
      message: 'Rango de disponibilidad eliminado correctamente',
      value: responseProperty
    });
  } catch (error) {
    console.error('Error eliminando rango de disponibilidad:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/properties/:id/availability', [validateId, optionalAuth], async (req, res) => {
  req.params.id = req.params.id;
  return router.handle(req, res);
});

router.get('/:id/availability', [validateId, optionalAuth], async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, activo: true })
      .select('disponibilidad estado')
      .lean();

    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    res.json({
      status: true,
      message: 'Disponibilidad obtenida correctamente',
      value: {
        availability: property.disponibilidad || [],
        estado: property.estado || 'disponible'
      }
    });

  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});
router.put('/Actualizar/:id', [protect, validateId, validateProperty], async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, activo: true });

    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    if (property.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para actualizar esta propiedad'
      });
    }

    const updates = { ...req.body };

    if (updates.availability && Array.isArray(updates.availability)) {
      property.disponibilidad = updates.availability.map(range => {
        const startDate = range.startDate ? new Date(range.startDate) : null;
        const endDate = range.endDate ? new Date(range.endDate) : null;

        if (!startDate || isNaN(startDate.getTime()) || !endDate || isNaN(endDate.getTime())) {
          console.error('Invalid date range:', range);
          return null;
        }

        return {
          startDate: startDate,
          endDate: endDate,
          status: range.status || 'disponible',
          clientName: range.clientName || '',
          deposit: parseFloat(range.deposit) || 0,
          guests: parseInt(range.guests) || 1,
          notes: range.notes || '',
          id: range.id || `range-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
      }).filter(Boolean);

      property.markModified('disponibilidad');

      console.log('Processed disponibilidad data:', JSON.stringify(property.disponibilidad, null, 2));

      delete updates.availability;
    }

    if ((!updates.latitud || !updates.longitud) && (updates.direccion || updates.barrio || updates.localidad || updates.provincia)) {
      const geocoded = await geocodeAddress({
        direccion: updates.direccion ?? property.direccion,
        barrio: updates.barrio ?? property.barrio,
        localidad: updates.localidad ?? property.localidad,
        provincia: updates.provincia ?? property.provincia
      });

      if (geocoded) {
        updates.latitud = geocoded.latitud;
        updates.longitud = geocoded.longitud;
      }
    }

    const arrayFields = ['servicios', 'reglasPropiedad', 'metodosPago'];
    arrayFields.forEach(field => {
      if (updates[field] && typeof updates[field] === 'string') {
        try {
          updates[field] = JSON.parse(updates[field]);
        } catch (e) {
          updates[field] = updates[field].split(',').map(item => item.trim());
        }
      }
    });

    Object.keys(updates).forEach(key => {
      if (key !== 'availability' && key !== '_id' && key !== '__v') {
        property[key] = updates[key];
      }
    });

    try {
      await property.save();
      console.log('Property saved successfully:', JSON.stringify(property.disponibilidad, null, 2));

      const updatedProperty = await Property.findById(req.params.id)
        .populate('idUsuarioCreador', 'nombre apellido correo');

      const responseProperty = updatedProperty.toObject();
      responseProperty.availability = responseProperty.disponibilidad || [];

      return res.json({
        status: true,
        message: 'Propiedad actualizada exitosamente',
        value: responseProperty
      });
    } catch (saveError) {
      console.error('Error saving property:', saveError);
      return res.status(500).json({
        status: false,
        message: 'Error al guardar la propiedad',
        error: process.env.NODE_ENV === 'development' ? saveError.message : 'Error interno'
      });
    }

  } catch (error) {
    console.error('Error actualizando propiedad:', error);

    if (error.name === 'ValidationError') {
      console.error('Validation Error Details:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({
        status: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }))
      });
    }

    console.error('Complete Error Object:', JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.errors && { errors: error.errors })
    }, null, 2));

    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message,
        stack: error.stack
      })
    });
  }
});
// ==================================================================
//               FIN DE RUTA ACTUALIZADA
// ==================================================================

router.delete('/Eliminar/:id', [protect, validateId], async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, activo: true });

    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    if (property.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para eliminar esta propiedad'
      });
    }

    property.activo = false;
    await property.save();

    res.json({
      status: true,
      message: 'Propiedad eliminada exitosamente',
      value: true
    });

  } catch (error) {
    console.error('Error eliminando propiedad:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.post('/ToggleFavorito/:id', [protect, validateId], async (req, res) => {
  try {
    const propertyId = req.params.id;

    const property = await Property.findOne({ _id: propertyId, activo: true });
    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    const result = await Favorite.toggleFavorite(req.user._id, propertyId);

    res.json({
      status: true,
      message: result.message,
      esFavorito: result.isFavorite
    });

  } catch (error) {
    console.error('Error toggle favorito:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/Favoritos', protect, async (req, res) => {
  try {
    const favorites = await Favorite.getUserFavorites(req.user._id);

    const validFavorites = favorites
      .filter(fav => fav.idPropiedad)
      .map(fav => ({
        ...fav.idPropiedad.toObject(),
        favorito: true
      }));

    res.json({
      status: true,
      message: 'Favoritos obtenidos exitosamente',
      value: validFavorites
    });

  } catch (error) {
    console.error('Error obteniendo favoritos:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.get('/MisPropiedades', protect, async (req, res) => {
  try {
    const properties = await Property.find({
      idUsuarioCreador: req.user._id,
      activo: true
    })
      .populate('idUsuarioCreador', 'nombre apellido correo')
      .sort({ fechaCreacion: -1 });

    res.json({
      status: true,
      message: 'Propiedades del usuario obtenidas exitosamente',
      value: properties
    });

  } catch (error) {
    console.error('Error obteniendo propiedades del usuario:', error);
    res.status().json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.post('/SubirImagenes/:id', [
  protect,
  validateId,
  uploadPropertyImages,
  handleMulterError
], async (req, res) => {
  try {
    console.log('=== SubirImagenes START ===');
    console.log('ID Propiedad:', req.params.id);
    console.log('User:', req.user._id);
    console.log('Archivos recibidos:', req.files ? req.files.length : 0);

    if (!req.files) {
      console.log('req.files es undefined o null');
      return res.status(400).json({
        status: false,
        message: 'No se recibieron archivos'
      });
    }

    const property = await Property.findOne({ _id: req.params.id, activo: true });

    if (!property) {
      console.log('Propiedad no encontrada:', req.params.id);
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    if (property.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      console.log('Permiso denegado');
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para subir imágenes a esta propiedad'
      });
    }

    if (req.files.length === 0) {
      console.log('Array de archivos vacío');
      return res.status(400).json({
        status: false,
        message: 'No se recibieron archivos'
      });
    }

    console.log('Validaciones pasadas. Procesando', req.files.length, 'archivos');

    const uploadedImages = req.files.map((file, index) => {
      console.log(`📁 Archivo ${index}:`, {
        originalname: file.originalname,
        path: file.path,
        secure_url: file.secure_url,
        filename: file.filename,
        public_id: file.public_id
      });

      const imageObj = {
        rutaArchivo: file.path || file.secure_url || file.url || '',
        public_id: file.filename || file.public_id || '',
        nombreArchivo: file.originalname,
        orden: property.imagenes.length + index
      };

      if (!imageObj.rutaArchivo) {
        console.warn(`Imagen ${index} sin URL:`, file);
      }

      return imageObj;
    });

    property.imagenes.push(...uploadedImages);
    const saved = await property.save();
    console.log('Propiedad actualizada. Total imágenes:', saved.imagenes.length);

    const imageUrls = uploadedImages.map(img => img.rutaArchivo);

    console.log('Subir Imagenes');
    res.json({
      status: true,
      message: `Se subieron ${uploadedImages.length} imágenes exitosamente`,
      value: saved
    });

  } catch (error) {
    console.error('Subir Imagenes');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);

    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.delete('/EliminarImagen/:propertyId/:imageId', protect, async (req, res) => {
  try {
    const { propertyId, imageId } = req.params;

    const property = await Property.findOne({ _id: propertyId, activo: true });

    if (!property) {
      return res.status(404).json({
        status: false,
        message: 'Propiedad no encontrada'
      });
    }

    if (property.idUsuarioCreador.toString() !== req.user._id.toString() && req.user.idrol !== 3) {
      return res.status(403).json({
        status: false,
        message: 'No tienes permisos para eliminar imágenes de esta propiedad'
      });
    }

    const imageIndex = property.imagenes.findIndex(img => img._id.toString() === imageId);

    if (imageIndex === -1) {
      return res.status(404).json({
        status: false,
        message: 'Imagen no encontrada'
      });
    }

    const image = property.imagenes[imageIndex];

    try {
      await deleteFile(image.public_id);
    } catch (error) {
      console.error('Error eliminando archivo de Cloudinary:', error);
    }

    property.imagenes.splice(imageIndex, 1);
    await property.save();

    res.json({
      status: true,
      message: 'Imagen eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando imagen:', error);
    res.status(500).json({
      status: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
});

router.use((err, req, res, next) => {
  console.error('Error in property routes:', err);
  res.status(500).json({
    status: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

router.use((req, res) => {
  console.log(`404: Route not found - ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

module.exports = router;