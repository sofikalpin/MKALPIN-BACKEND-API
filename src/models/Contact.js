const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Por favor ingresa un email válido']
  },
  telefono: {
    type: String,
    trim: true,
    maxlength: [20, 'El teléfono no puede exceder 20 caracteres']
  },
  asunto: {
    type: String,
    trim: true,
    maxlength: [100, 'El asunto no puede exceder 100 caracteres']
  },
  mensaje: {
    type: String,
    required: [true, 'El mensaje es requerido'],
    trim: true,
    maxlength: [2000, 'El mensaje no puede exceder 2000 caracteres']
  },
  tipoConsulta: {
    type: String,
    enum: ['General', 'Propiedad', 'Tasacion', 'Alquiler', 'Venta', 'Soporte'],
    default: 'General',
    index: true
  },
  idPropiedadConsulta: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  estado: {
    type: String,
    enum: ['Nuevo', 'En_Proceso', 'Respondido', 'Cerrado'],
    default: 'Nuevo',
    index: true
  },
  fechaContacto: {
    type: Date,
    default: Date.now,
    index: true
  },
  fechaRespuesta: {
    type: Date
  },
  respuesta: {
    type: String,
    trim: true,
    maxlength: [2000, 'La respuesta no puede exceder 2000 caracteres']
  },
  idUsuarioAsignado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  }
}, {
  timestamps: {
    createdAt: 'fechaCreacion',
    updatedAt: 'fechaActualizacion'
  }
});

contactSchema.index({ estado: 1, fechaContacto: -1 });
contactSchema.index({ tipoConsulta: 1, estado: 1 });
contactSchema.index({ email: 1 });
contactSchema.index({
  nombre: 'text',
  email: 'text',
  asunto: 'text',
  mensaje: 'text'
});

contactSchema.virtual('idContacto').get(function() {
  return this._id.toHexString();
});

contactSchema.virtual('pendienteRespuesta').get(function() {
  return ['Nuevo', 'En_Proceso'].includes(this.estado);
});

contactSchema.virtual('tiempoRespuesta').get(function() {
  if (!this.fechaRespuesta) return null;
  
  const diffTime = this.fechaRespuesta - this.fechaContacto;
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  
  return {
    horas: diffHours,
    dias: Math.ceil(diffHours / 24)
  };
});

contactSchema.methods.responder = function(respuesta, usuarioId) {
  this.respuesta = respuesta;
  this.estado = 'Respondido';
  this.fechaRespuesta = new Date();
  this.idUsuarioAsignado = usuarioId;
  return this.save();
};

contactSchema.methods.cambiarEstado = function(nuevoEstado, usuarioId = null) {
  const estadosValidos = ['Nuevo', 'En_Proceso', 'Respondido', 'Cerrado'];
  if (!estadosValidos.includes(nuevoEstado)) {
    throw new Error('Estado inválido');
  }
  
  this.estado = nuevoEstado;
  if (nuevoEstado === 'En_Proceso' && !this.idUsuarioAsignado && usuarioId) {
    this.idUsuarioAsignado = usuarioId;
  }
  
  return this.save();
};

contactSchema.statics.getEstadisticas = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        nuevos: { $sum: { $cond: [{ $eq: ['$estado', 'Nuevo'] }, 1, 0] } },
        enProceso: { $sum: { $cond: [{ $eq: ['$estado', 'En_Proceso'] }, 1, 0] } },
        respondidos: { $sum: { $cond: [{ $eq: ['$estado', 'Respondido'] }, 1, 0] } },
        cerrados: { $sum: { $cond: [{ $eq: ['$estado', 'Cerrado'] }, 1, 0] } }
      }
    }
  ]);
  
  const porTipo = await this.aggregate([
    { $group: { _id: '$tipoConsulta', cantidad: { $sum: 1 } } },
    { $project: { tipo: '$_id', cantidad: 1, _id: 0 } }
  ]);
  
  const ultimaSemana = await this.countDocuments({
    fechaContacto: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });
  
  return {
    ...(stats[0] || { total: 0, nuevos: 0, enProceso: 0, respondidos: 0, cerrados: 0 }),
    porTipo,
    ultimaSemana
  };
};

contactSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    ret.idContacto = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.ipAddress;
    delete ret.userAgent;
    return ret;
  }
});

module.exports = mongoose.model('Contact', contactSchema);