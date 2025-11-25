const mongoose = require('mongoose');

const imagenTasacionSchema = new mongoose.Schema({
  rutaArchivo: { type: String, required: true },
  nombreArchivo: { type: String, required: true },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [255, 'La descripción no puede exceder 255 caracteres']
  },
  orden: { type: Number, default: 0 },
  fechaCreacion: { type: Date, default: Date.now }
});

const tasacionSchema = new mongoose.Schema({
  idPropiedad: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  idCliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  tituloPropiedad: {
    type: String,
    required: [true, 'El título de la propiedad es requerido'],
    trim: true,
    maxlength: [255, 'El título no puede exceder 255 caracteres']
  },
  direccionPropiedad: {
    type: String,
    required: [true, 'La dirección es requerida'],
    trim: true,
    maxlength: [500, 'La dirección no puede exceder 500 caracteres']
  },
  barrioPropiedad: {
    type: String,
    trim: true,
    maxlength: [100, 'El barrio no puede exceder 100 caracteres']
  },
  localidadPropiedad: {
    type: String,
    trim: true,
    maxlength: [100, 'La localidad no puede exceder 100 caracteres']
  },
  provinciaPropiedad: {
    type: String,
    trim: true,
    maxlength: [100, 'La provincia no puede exceder 100 caracteres']
  },
  tipoPropiedad: {
    type: String,
    required: [true, 'El tipo de propiedad es requerido'],
    enum: ['Casa', 'Apartamento', 'Local', 'Terreno', 'Oficina', 'Depósito'],
    index: true
  },
  habitaciones: { type: Number, min: [0, 'Las habitaciones no pueden ser negativas'] },
  banos: { type: Number, min: [0, 'Los baños no pueden ser negativos'] },
  superficieM2: { type: Number, min: [0, 'La superficie no puede ser negativa'] },
  valorEstimado: { type: Number, min: [0, 'El valor estimado debe ser mayor a 0'] },
  valorMinimo: { type: Number, min: [0, 'El valor mínimo debe ser mayor a 0'] },
  valorMaximo: { type: Number, min: [0, 'El valor máximo debe ser mayor a 0'] },
  estado: {
    type: String,
    enum: ['Pendiente', 'En_Proceso', 'Completada', 'Cancelada'],
    default: 'Pendiente',
    index: true
  },
  observaciones: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las observaciones no pueden exceder 1000 caracteres']
  },
  detallesTasacion: {
    type: String,
    trim: true,
    maxlength: [2000, 'Los detalles no pueden exceder 2000 caracteres']
  },
  nombreSolicitante: {
    type: String,
    trim: true,
    maxlength: [255, 'El nombre del solicitante no puede exceder 255 caracteres']
  },
  emailSolicitante: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email del solicitante inválido']
  },
  telefonoSolicitante: {
    type: String,
    trim: true,
    maxlength: [20, 'El teléfono no puede exceder 20 caracteres']
  },
  fechaSolicitud: { type: Date, default: Date.now, index: true },
  fechaVisita: { type: Date },
  fechaCompletada: { type: Date },
  imagenesTasacion: [imagenTasacionSchema],
  idUsuarioAsignado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  idUsuarioCreador: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: {
    createdAt: 'fechaCreacion',
    updatedAt: 'fechaActualizacion'
  }
});

tasacionSchema.index({ estado: 1, fechaSolicitud: -1 });
tasacionSchema.index({ tipoPropiedad: 1, estado: 1 });
tasacionSchema.index({ idUsuarioAsignado: 1, estado: 1 });
tasacionSchema.index({ emailSolicitante: 1 });
tasacionSchema.index({
  tituloPropiedad: 'text',
  direccionPropiedad: 'text',
  nombreSolicitante: 'text',
  emailSolicitante: 'text'
});

tasacionSchema.virtual('idTasacion').get(function() {
  return this._id.toHexString();
});

tasacionSchema.virtual('diasDesdeSolicitud').get(function() {
  const diffTime = new Date() - this.fechaSolicitud;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

tasacionSchema.virtual('estaVencida').get(function() {
  const diasLimite = 30;
  return this.estado !== 'Completada' && this.diasDesdeSolicitud > diasLimite;
});

tasacionSchema.virtual('rangoValor').get(function() {
  if (!this.valorMinimo || !this.valorMaximo) return null;
  return {
    minimo: this.valorMinimo,
    maximo: this.valorMaximo,
    promedio: (this.valorMinimo + this.valorMaximo) / 2,
    diferencia: this.valorMaximo - this.valorMinimo
  };
});

tasacionSchema.pre('save', function(next) {
  if (this.valorMinimo && this.valorMaximo && this.valorMaximo <= this.valorMinimo) {
    return next(new Error('El valor máximo debe ser mayor que el valor mínimo'));
  }
  if (this.valorEstimado && this.valorMinimo && this.valorMaximo) {
    if (this.valorEstimado < this.valorMinimo || this.valorEstimado > this.valorMaximo) {
      return next(new Error('El valor estimado debe estar entre el valor mínimo y máximo'));
    }
  }
  if (this.estado === 'Completada' && !this.fechaCompletada) {
    this.fechaCompletada = new Date();
  }
  next();
});

tasacionSchema.methods.actualizarEstado = function(nuevoEstado, usuarioId) {
  const estadosValidos = ['Pendiente', 'En_Proceso', 'Completada', 'Cancelada'];
  if (!estadosValidos.includes(nuevoEstado)) {
    throw new Error('Estado inválido');
  }
  this.estado = nuevoEstado;
  if (nuevoEstado === 'En_Proceso' && !this.idUsuarioCreador) {
    this.idUsuarioCreador = usuarioId;
  }
  if (nuevoEstado === 'Completada') {
    this.fechaCompletada = new Date();
  }
  return this.save();
};

tasacionSchema.methods.programarVisita = function(fechaVisita) {
  if (this.estado === 'Completada' || this.estado === 'Cancelada') {
    throw new Error('No se puede programar visita para tasaciones completadas o canceladas');
  }
  this.fechaVisita = fechaVisita;
  if (this.estado === 'Pendiente') {
    this.estado = 'En_Proceso';
  }
  return this.save();
};

tasacionSchema.methods.agregarImagen = function(imagenData) {
  this.imagenesTasacion.push({
    ...imagenData,
    orden: this.imagenesTasacion.length
  });
  return this.save();
};

tasacionSchema.statics.getEstadisticas = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pendientes: { $sum: { $cond: [{ $eq: ['$estado', 'Pendiente'] }, 1, 0] } },
        enProceso: { $sum: { $cond: [{ $eq: ['$estado', 'En_Proceso'] }, 1, 0] } },
        completadas: { $sum: { $cond: [{ $eq: ['$estado', 'Completada'] }, 1, 0] } },
        canceladas: { $sum: { $cond: [{ $eq: ['$estado', 'Cancelada'] }, 1, 0] } },
        valorPromedio: { $avg: '$valorEstimado' }
      }
    }
  ]);

  const porTipo = await this.aggregate([
    {
      $group: {
        _id: '$tipoPropiedad',
        cantidad: { $sum: 1 },
        valorPromedio: { $avg: '$valorEstimado' }
      }
    },
    {
      $project: {
        tipo: '$_id',
        cantidad: 1,
        valorPromedio: { $round: ['$valorPromedio', 2] },
        _id: 0
      }
    }
  ]);

  const ultimaSemana = await this.countDocuments({
    fechaSolicitud: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });

  return {
    ...(stats[0] || {
      total: 0,
      pendientes: 0,
      enProceso: 0,
      completadas: 0,
      canceladas: 0,
      valorPromedio: 0
    }),
    porTipo,
    ultimaSemana
  };
};

tasacionSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.idTasacion = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Tasacion', tasacionSchema);
