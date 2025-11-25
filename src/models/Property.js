const mongoose = require('mongoose');

const imagenPropiedadSchema = new mongoose.Schema({
  rutaArchivo: { type: String, required: true },
  nombreArchivo: { type: String, required: true },
  orden: { type: Number, default: 0 },
  fechaCreacion: { type: Date, default: Date.now }
});

const availabilitySchema = new mongoose.Schema({
  startDate: {
    type: Date,
    required: [true, 'La fecha de inicio es requerida']
  },
  endDate: {
    type: Date,
    required: [true, 'La fecha de fin es requerida'],
    validate: {
      validator: function (endDate) {
        return endDate > this.startDate;
      },
      message: 'La fecha de fin debe ser posterior a la fecha de inicio'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['disponible', 'reservado_temp', 'ocupado_temp'],
      message: 'Estado de disponibilidad no válido'
    },
    default: 'disponible',
    required: [true, 'El estado de disponibilidad es requerido']
  },
  clientName: {
    type: String,
    trim: true,
    default: ''
  },
  deposit: {
    type: Number,
    min: [0, 'El depósito no puede ser negativo'],
    default: 0
  },
  guests: {
    type: Number,
    min: [1, 'Debe haber al menos un huésped'],
    default: 1
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  id: {
    type: String,
    required: [true, 'El ID es requerido']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const propertySchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: [true, 'El título es requerido'],
    trim: true,
    maxlength: [255, 'El título no puede exceder 255 caracteres']
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [1000, 'La descripción no puede exceder 1000 caracteres']
  },
  direccion: {
    type: String,
    required: [true, 'La dirección es requerida'],
    trim: true,
    maxlength: [255, 'La dirección no puede exceder 255 caracteres']
  },
  barrio: {
    type: String,
    trim: true,
    maxlength: [100, 'El barrio no puede exceder 100 caracteres'],
    index: true
  },
  localidad: {
    type: String,
    trim: true,
    maxlength: [100, 'La localidad no puede exceder 100 caracteres']
  },
  provincia: {
    type: String,
    trim: true,
    maxlength: [100, 'La provincia no puede exceder 100 caracteres']
  },
  ubicacion: {
    type: String,
    trim: true,
    maxlength: [100, 'La ubicación no puede exceder 100 caracteres']
  },
  tipoPropiedad: {
    type: String,
    required: [true, 'El tipo de propiedad es requerido'],
    enum: ['Casa', 'Apartamento', 'Local', 'Terreno', 'Oficina', 'Depósito'],
    index: true
  },
  transaccionTipo: {
    type: String,
    required: [true, 'El tipo de transacción es requerido'],
    enum: ['Venta', 'Alquiler', 'Alquiler Temporario'],
    default: 'Venta',
    index: true
  },
  precio: {
    type: Number,
    required: [true, 'El precio es requerido'],
    min: [0, 'El precio debe ser mayor a 0'],
    index: true
  },
  habitaciones: {
    type: Number,
    min: [0, 'El número de habitaciones no puede ser negativo'],
    index: true
  },
  banos: {
    type: Number,
    min: [0, 'El número de baños no puede ser negativo']
  },
  superficieM2: {
    type: Number,
    min: [0, 'La superficie no puede ser negativa']
  },
  terrenoM2: {
    type: Number,
    min: [0, 'La superficie del terreno no puede ser negativa']
  },
  estado: {
    type: String,
    enum: ['Disponible', 'Reservado', 'Ocupado', 'Vendido'],
    default: 'Disponible',
    index: true
  },
  latitud: {
    type: Number,
    min: [-90, 'La latitud debe estar entre -90 y 90'],
    max: [90, 'La latitud debe estar entre -90 y 90']
  },
  longitud: {
    type: Number,
    min: [-180, 'La longitud debe estar entre -180 y 180'],
    max: [180, 'La longitud debe estar entre -180 y 180']
  },
  esAlquilerTemporario: { type: Boolean, default: false, index: true },
  precioPorNoche: { type: Number, min: [0, 'El precio por noche debe ser mayor a 0'] },
  precioPorSemana: { type: Number, min: [0, 'El precio por semana debe ser mayor a 0'] },
  precioPorMes: { type: Number, min: [0, 'El precio por mes debe ser mayor a 0'] },
  capacidadPersonas: { type: Number, min: [1, 'La capacidad debe ser al menos 1 persona'] },
  especificaciones: { type: [String], default: [] },
  servicios: { type: [String], default: [] },
  reglasPropiedad: { type: [String], default: [] },
  horarioCheckIn: { type: String, match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'] },
  horarioCheckOut: { type: String, match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'] },
  estadiaMinima: { type: Number, min: [1, 'La estadía mínima debe ser al menos 1 noche'], default: 1 },
  politicaCancelacion: {
    type: String,
    enum: ['Flexible', 'Moderada', 'Estricta'],
    default: 'Moderada'
  },
  currency: {
    type: String,
    enum: ['USD', 'ARS', 'EUR', 'BRL'],
    default: 'USD',
    required: [true, 'La moneda es requerida']
  },
  disponibilidad: [availabilitySchema],
  imagenes: [imagenPropiedadSchema],
  disponible: {
    type: Boolean,
    default: true,
    index: true
  },
  idUsuarioCreador: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  activo: {
    type: Boolean,
    default: true,
    index: true
  },
  favorito: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'fechaCreacion',
    updatedAt: 'fechaActualizacion'
  }
});

propertySchema.index({ transaccionTipo: 1, tipoPropiedad: 1 });
propertySchema.index({ transaccionTipo: 1, precio: 1 });
propertySchema.index({ transaccionTipo: 1, habitaciones: 1 });
propertySchema.index({ barrio: 1, transaccionTipo: 1 });
propertySchema.index({ estado: 1, activo: 1 });
propertySchema.index({ esAlquilerTemporario: 1, transaccionTipo: 1 });
propertySchema.index({ latitud: 1, longitud: 1 });
propertySchema.index({
  titulo: 'text',
  descripcion: 'text',
  direccion: 'text',
  barrio: 'text',
  localidad: 'text'
});

propertySchema.virtual('idPropiedad').get(function () {
  return this._id.toHexString();
});

propertySchema.virtual('coordenadas').get(function () {
  if (this.latitud && this.longitud) {
    return { lat: this.latitud, lng: this.longitud };
  }
  return null;
});

propertySchema.methods.getImageUrls = function (baseUrl = '') {
  return this.imagenes.map(img => ({
    ...img.toObject(),
    url: `${baseUrl}/uploads/${img.rutaArchivo}`
  }));
};

propertySchema.statics.searchProperties = function (filters = {}) {
  const query = { activo: true };

  if (filters.transaccionTipo) query.transaccionTipo = new RegExp(filters.transaccionTipo, 'i');
  if (filters.tipoPropiedad) query.tipoPropiedad = new RegExp(filters.tipoPropiedad, 'i');

  if (filters.barrio || filters.ubicacion) {
    const ubicacionTerm = filters.barrio || filters.ubicacion;
    query.$or = [
      { barrio: new RegExp(ubicacionTerm, 'i') },
      { localidad: new RegExp(ubicacionTerm, 'i') },
      { ubicacion: new RegExp(ubicacionTerm, 'i') },
      { direccion: new RegExp(ubicacionTerm, 'i') }
    ];
  }

  if (filters.precioMin || filters.precioMax) {
    query.precio = {};
    if (filters.precioMin) query.precio.$gte = Number(filters.precioMin);
    if (filters.precioMax) query.precio.$lte = Number(filters.precioMax);
  }

  if (filters.habitacionesMin) query.habitaciones = { $gte: Number(filters.habitacionesMin) };
  if (filters.banosMin) query.banos = { $gte: Number(filters.banosMin) };

  if (filters.superficieMin || filters.superficieMax) {
    query.superficieM2 = {};
    if (filters.superficieMin) query.superficieM2.$gte = Number(filters.superficieMin);
    if (filters.superficieMax) query.superficieM2.$lte = Number(filters.superficieMax);
  }

  if (filters.estado) query.estado = filters.estado;
  if (filters.esAlquilerTemporario !== undefined) query.esAlquilerTemporario = filters.esAlquilerTemporario;

  return this.find(query)
    .populate('idUsuarioCreador', 'nombre apellido correo')
    .sort({ fechaCreacion: -1 });
};

propertySchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    ret.idPropiedad = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Property', propertySchema);