const mongoose = require('mongoose');

const pagoReservaSchema = new mongoose.Schema({
  monto: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [0, 'El monto debe ser mayor a 0']
  },
  metodoPago: {
    type: String,
    required: [true, 'El método de pago es requerido'],
    enum: ['Efectivo', 'Transferencia', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'PayPal', 'MercadoPago']
  },
  estadoPago: {
    type: String,
    enum: ['Pendiente', 'Pagado', 'Fallido', 'Reembolsado'],
    default: 'Pagado'
  },
  fechaPago: {
    type: Date,
    default: Date.now
  },
  numeroTransaccion: {
    type: String,
    trim: true
  },
  notasPago: {
    type: String,
    trim: true,
    maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
  }
});

const reservationSchema = new mongoose.Schema({
  idPropiedad: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'La propiedad es requerida'],
    index: true
  },
  idCliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'El cliente es requerido'],
    index: true
  },
  fechaInicio: {
    type: Date,
    required: [true, 'La fecha de inicio es requerida'],
    index: true
  },
  fechaFin: {
    type: Date,
    required: [true, 'La fecha de fin es requerida'],
    index: true
  },
  estado: {
    type: String,
    enum: ['Disponible', 'Reservado', 'Ocupado'],
    default: 'Disponible',
    index: true
  },
  montoTotal: {
    type: Number,
    required: [true, 'El monto total es requerido'],
    min: [0, 'El monto total debe ser mayor a 0']
  },
  depositoPagado: {
    type: Number,
    min: [0, 'El depósito debe ser mayor o igual a 0'],
    default: 0
  },
  metodoPago: {
    type: String,
    enum: ['Efectivo', 'Transferencia', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'PayPal', 'MercadoPago']
  },
  notas: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las notas no pueden exceder 1000 caracteres']
  },
  nombreHuesped: {
    type: String,
    trim: true,
    maxlength: [255, 'El nombre del huésped no puede exceder 255 caracteres']
  },
  emailHuesped: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email del huésped inválido']
  },
  telefonoHuesped: {
    type: String,
    trim: true,
    maxlength: [20, 'El teléfono del huésped no puede exceder 20 caracteres']
  },
  cantidadPersonas: {
    type: Number,
    min: [1, 'La cantidad de personas debe ser al menos 1']
  },
  fechaCheckIn: { type: Date },
  fechaCheckOut: { type: Date },
  pagos: [pagoReservaSchema],
  idUsuarioCreador: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: {
    createdAt: 'fechaCreacion',
    updatedAt: 'fechaActualizacion'
  }
});

reservationSchema.index({ idPropiedad: 1, fechaInicio: 1, fechaFin: 1 });
reservationSchema.index({ idCliente: 1, estado: 1 });
reservationSchema.index({ estado: 1, fechaInicio: 1 });
reservationSchema.index({ fechaInicio: 1, fechaFin: 1, estado: 1 });

reservationSchema.virtual('idReserva').get(function() {
  return this._id.toHexString();
});

reservationSchema.virtual('diasEstadia').get(function() {
  if (!this.fechaInicio || !this.fechaFin) return 0;
  const diffTime = Math.abs(this.fechaFin - this.fechaInicio);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

reservationSchema.virtual('montoPendiente').get(function() {
  return Math.max(0, this.montoTotal - this.depositoPagado);
});

reservationSchema.virtual('estaActiva').get(function() {
  const now = new Date();
  return this.estado === 'Confirmada' && this.fechaInicio <= now && this.fechaFin >= now;
});

reservationSchema.pre('save', async function(next) {
  if (this.fechaFin <= this.fechaInicio) {
    return next(new Error('La fecha de fin debe ser posterior a la fecha de inicio'));
  }

  if (this.isNew) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (this.fechaInicio < now) {
      return next(new Error('La fecha de inicio no puede ser en el pasado'));
    }
  }
  
  if(this.isNew || this.isModified('cantidadPersonas')){
    const property = await mongoose.model('Property').findById(this.idPropiedad);
    if (property && property.capacidadPersonas && this.cantidadPersonas > property.capacidadPersonas) {
      return next(new Error('La cantidad de personas excede la capacidad de la propiedad'));
    }
  }

  next();
});

reservationSchema.statics.checkAvailability = async function(propertyId, startDate, endDate, excludeReservationId = null) {
  const query = {
    idPropiedad: propertyId,
    estado: { $nin: ['Cancelada'] },
    $or: [
      { fechaInicio: { $lt: endDate }, fechaFin: { $gt: startDate } }
    ]
  };

  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  const conflictingReservations = await this.find(query);
  return conflictingReservations.length === 0;
};

reservationSchema.statics.getAvailableDates = async function(propertyId, startDate, endDate) {
    const reservations = await this.find({
        idPropiedad: propertyId,
        estado: { $nin: ['Cancelada'] },
        fechaFin: { $gt: new Date(startDate) },
        fechaInicio: { $lt: new Date(endDate) }
    }).select('fechaInicio fechaFin');

    const availableDates = [];
    const currentDate = new Date(startDate);
    const finalDate = new Date(endDate);

    while (currentDate <= finalDate) {
        const isAvailable = !reservations.some(reservation =>
            currentDate >= reservation.fechaInicio && currentDate < reservation.fechaFin
        );

        if (isAvailable) {
            availableDates.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return availableDates;
};

reservationSchema.methods.addPayment = function(paymentData) {
  this.pagos.push(paymentData);
  this.depositoPagado += paymentData.monto;
  return this.save();
};

reservationSchema.methods.confirm = function() {
  if (this.estado !== 'Pendiente') {
    throw new Error('Solo se pueden confirmar reservas pendientes');
  }
  this.estado = 'Confirmada';
  return this.save();
};

reservationSchema.methods.cancel = function(motivo = '') {
  if (this.estado === 'Completada') {
    throw new Error('No se pueden cancelar reservas completadas');
  }
  this.estado = 'Cancelada';
  if (motivo) {
    this.notas = this.notas ? `${this.notas}\nCancelada: ${motivo}` : `Cancelada: ${motivo}`;
  }
  return this.save();
};

reservationSchema.methods.complete = function() {
  if (this.estado !== 'Confirmada') {
    throw new Error('Solo se pueden completar reservas confirmadas');
  }
  this.estado = 'Completada';
  this.fechaCheckOut = new Date();
  return this.save();
};

reservationSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.idReserva = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Reservation', reservationSchema);
