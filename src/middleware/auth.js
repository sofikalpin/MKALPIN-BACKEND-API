const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: false,
        message: 'No tienes autorización para acceder a esta ruta, token requerido'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta_jwt_muy_larga_y_segura_aqui');
      const user = await User.findById(decoded.id).select('-contrasenaHash');

      if (!user) {
        return res.status(401).json({
          status: false,
          message: 'El usuario asociado a este token ya no existe'
        });
      }

      if (!user.activo) {
        return res.status(401).json({
          status: false,
          message: 'Usuario inactivo'
        });
      }

      if (user.isBlocked) {
        return res.status(401).json({
          status: false,
          message: 'Usuario bloqueado temporalmente por intentos fallidos de login'
        });
      }

      req.user = user;
      next();

    } catch (error) {
      return res.status(401).json({
        status: false,
        message: 'Token inválido'
      });
    }

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: 'Error del servidor en autenticación',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: false,
        message: 'Usuario no autenticado'
      });
    }

    const userRole = req.user.rol || (req.user.idrol === 1 ? 'Propietario' : req.user.idrol === 2 ? 'Inquilino' : req.user.idrol === 3 ? 'Administrador' : req.user.idrol === 4 ? 'Comprador' : 'Usuario');

    if (!roles.includes(userRole) && !roles.includes(req.user.idrol)) {
      return res.status(403).json({
        status: false,
        message: `No tienes permisos para realizar esta acción. Rol requerido: ${roles.join(' o ')}`
      });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta_jwt_muy_larga_y_segura_aqui');
        const user = await User.findById(decoded.id).select('-contrasenaHash');

        if (user && user.activo && !user.isBlocked) {
          req.user = user;
        }
      } catch (error) {
      }
    }

    next();
  } catch (error) {
    next();
  }
};

const checkOwnership = (model, idField = 'idUsuarioCreador') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const userId = req.user._id;
      const userRole = req.user.rol;

      if (userRole === 'Administrador' || req.user.idrol === 3) {
        return next();
      }

      const resource = await model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          status: false,
          message: 'Recurso no encontrado'
        });
      }

      if (resource[idField].toString() !== userId.toString()) {
        return res.status(403).json({
          status: false,
          message: 'No tienes permisos para acceder a este recurso'
        });
      }

      req.resource = resource;
      next();

    } catch (error) {
      return res.status(500).json({
        status: false,
        message: 'Error verificando permisos',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
      });
    }
  };
};

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'tu_clave_secreta_jwt_muy_larga_y_segura_aqui',
    {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta_jwt_muy_larga_y_segura_aqui');
  } catch (error) {
    return null;
  }
};

module.exports = {
  protect,
  authorize,
  optionalAuth,
  checkOwnership,
  generateToken,
  verifyToken
};