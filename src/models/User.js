const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  apellido: {
    type: String,
    required: [true, 'El apellido es requerido'],
    trim: true,
    maxlength: [100, 'El apellido no puede exceder 100 caracteres']
  },
  correo: {
    type: String,
    required: [true, 'El correo es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Por favor ingresa un correo electrónico válido']
  },
  contrasenaHash: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
  },
  idrol: {
    type: Number,
    required: true,
    enum: [1, 2, 3, 4],
    default: 2
  },
  rol: {
    type: String,
    enum: ['Propietario', 'Inquilino', 'Administrador', 'Comprador'],
    default: 'Inquilino'
  },
  autProf: {
    type: Boolean,
    default: false
  },
  telefono: {
    type: String,
    trim: true,
    maxlength: [20, 'El teléfono no puede exceder 20 caracteres']
  },
  fotoRuta: {
    type: String,
    trim: true
  },
  activo: {
    type: Boolean,
    default: true
  },
  ultimoAcceso: {
    type: Date
  },
  intentosLogin: {
    type: Number,
    default: 0
  },
  bloqueadoHasta: {
    type: Date
  },
  tokenRecuperacion: {
    type: String
  },
  tokenRecuperacionExpira: {
    type: Date
  }
}, {
  timestamps: {
    createdAt: 'fechaCreacion',
    updatedAt: 'fechaActualizacion'
  }
}, {
  tokenRecuperacion: {
    type: String
  },
  tokenRecuperacionExpira: {
    type: Date
  },
});

userSchema.index({ idrol: 1 });
userSchema.index({ activo: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('contrasenaHash')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.contrasenaHash = await bcrypt.hash(this.contrasenaHash, salt);

    switch(this.idrol) {
      case 1:
        this.rol = 'Propietario';
        break;
      case 2:
        this.rol = 'Inquilino';
        break;
      case 3:
        this.rol = 'Administrador';
        this.autProf = true;
        break;
      case 4:
        this.rol = 'Comprador';
        break;
      default:
        this.rol = 'Inquilino';
    }
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.contrasenaHash);
};

userSchema.methods.toPublicJSON = function() {
  const userObject = this.toObject();
  delete userObject.contrasenaHash;
  delete userObject.intentosLogin;
  delete userObject.bloqueadoHasta;
  delete userObject.tokenRecuperacion;
  delete userObject.tokenRecuperacionExpira;
  delete userObject.__v;
  return userObject;
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ correo: email.toLowerCase(), activo: true });
};

userSchema.methods.updateLastAccess = function() {
  this.ultimoAcceso = new Date();
  this.intentosLogin = 0;
  this.bloqueadoHasta = undefined;
  return this.save();
};

userSchema.methods.incrementLoginAttempts = function() {
  this.intentosLogin += 1;
  if (this.intentosLogin >= 5) {
    this.bloqueadoHasta = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
  return this.save();
};

userSchema.virtual('isBlocked').get(function() {
  return !!(this.bloqueadoHasta && this.bloqueadoHasta > new Date());
});

module.exports = mongoose.model('User', userSchema);