const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

const validateRegister = [
  body('nombre').trim().isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('apellido').trim().isLength({ min: 2, max: 100 }).withMessage('El apellido debe tener entre 2 y 100 caracteres'),
  body('correo').isEmail().normalizeEmail().withMessage('Debe ser un correo electrónico válido'),
  body('contrasena').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('idrol').isInt({ min: 1, max: 3 }).withMessage('El rol debe ser 1 (Propietario), 2 (Inquilino) o 3 (Administrador)'),
  body('telefono').optional().isMobilePhone('es-AR').withMessage('Formato de teléfono inválido'),
  handleValidationErrors
];

const validateLogin = [
  body('correo').isEmail().normalizeEmail().withMessage('Debe ser un correo electrónico válido'),
  body('contrasenaHash').notEmpty().withMessage('La contraseña es requerida'),
  handleValidationErrors
];

const validateProperty = [
  body('titulo').trim().isLength({ min: 5, max: 255 }).withMessage('El título debe tener entre 5 y 255 caracteres'),
  body('direccion').trim().isLength({ min: 5, max: 255 }).withMessage('La dirección debe tener entre 5 y 255 caracteres'),
  body('precio').isFloat({ min: 0 }).withMessage('El precio debe ser un número mayor a 0'),
  body('tipoPropiedad').isIn(['Casa', 'Apartamento', 'Local', 'Terreno', 'Oficina', 'Depósito']).withMessage('Tipo de propiedad inválido'),
  body('transaccionTipo').isIn(['Venta', 'Alquiler', 'Alquiler Temporario']).withMessage('Tipo de transacción debe ser Venta, Alquiler o Alquiler Temporario'),
  body('habitaciones').optional().isInt({ min: 0 }).withMessage('Las habitaciones deben ser un número entero mayor o igual a 0'),
  body('banos').optional().isInt({ min: 0 }).withMessage('Los baños deben ser un número entero mayor o igual a 0'),
  body('superficieM2').optional().isFloat({ min: 0 }).withMessage('La superficie debe ser un número mayor o igual a 0'),
  body('estadiaMinima').optional().isInt({ min: 1 }).withMessage('La estadía mínima debe ser al menos 1 noche'),
  body('latitud').optional().isFloat({ min: -90, max: 90 }).withMessage('La latitud debe estar entre -90 y 90'),
  body('longitud').optional().isFloat({ min: -180, max: 180 }).withMessage('La longitud debe estar entre -180 y 180'),
  handleValidationErrors
];

const validateClient = [
  body('nombreCompleto').trim().isLength({ min: 3, max: 255 }).withMessage('El nombre completo debe tener entre 3 y 255 caracteres'),
  body('dni').trim().matches(/^[0-9]+$/).isLength({ min: 7, max: 8 }).withMessage('El DNI debe contener solo números y tener entre 7 y 8 dígitos'),
  body('email').isEmail().normalizeEmail().withMessage('Debe ser un email válido'),
  body('telefono').trim().isLength({ min: 8, max: 20 }).withMessage('El teléfono debe tener entre 8 y 20 caracteres'),
  body('domicilio').trim().isLength({ min: 5, max: 500 }).withMessage('El domicilio debe tener entre 5 y 500 caracteres'),
  body('rol').isIn(['Locador', 'Locatario', 'Propietario', 'Comprador']).withMessage('Rol inválido'),
  body('tipoAlquiler').optional().isIn(['Alquiler Temporario', 'Alquiler']).withMessage('Tipo de alquiler inválido'),
  body('fechaNacimiento').optional().isISO8601().toDate().custom((value) => {
    const age = new Date().getFullYear() - value.getFullYear();
    if (age < 18 || age > 120) {
      throw new Error('La edad debe estar entre 18 y 120 años');
    }
    return true;
  }),
  body('ingresosMensuales').optional().isFloat({ min: 0 }).withMessage('Los ingresos mensuales deben ser un número mayor o igual a 0'),
  handleValidationErrors
];

const validateReservation = [
  body('idPropiedad').isMongoId().withMessage('ID de propiedad inválido'),
  body('idCliente').isMongoId().withMessage('ID de cliente inválido'),
  body('fechaInicio').isISO8601().toDate().custom((value) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (value < today) {
      throw new Error('La fecha de inicio no puede ser en el pasado');
    }
    return true;
  }),
  body('fechaFin').isISO8601().toDate().custom((value, { req }) => {
    if (value <= new Date(req.body.fechaInicio)) {
      throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    }
    return true;
  }),
  body('montoTotal').isFloat({ min: 0 }).withMessage('El monto total debe ser mayor a 0'),
  body('cantidadPersonas').optional().isInt({ min: 1, max: 20 }).withMessage('La cantidad de personas debe estar entre 1 y 20'),
  body('nombreHuesped').optional().trim().isLength({ max: 255 }).withMessage('El nombre del huésped no puede exceder 255 caracteres'),
  body('emailHuesped').optional().isEmail().normalizeEmail().withMessage('Email del huésped inválido'),
  body('estado').optional().isIn(['Disponible', 'Reservado', 'Ocupado']).withMessage('Estado de reserva inválido'),
  handleValidationErrors
];

const validateContact = [
  body('nombre').trim().isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('email').isEmail().normalizeEmail().withMessage('Debe ser un email válido'),
  body('mensaje').trim().isLength({ min: 10, max: 2000 }).withMessage('El mensaje debe tener entre 10 y 2000 caracteres'),
  body('telefono').optional().trim().isLength({ max: 20 }).withMessage('El teléfono no puede exceder 20 caracteres'),
  body('asunto').optional().trim().isLength({ max: 100 }).withMessage('El asunto no puede exceder 100 caracteres'),
  body('tipoConsulta').optional().isIn(['General', 'Propiedad', 'Tasacion', 'Alquiler', 'Venta', 'Soporte']).withMessage('Tipo de consulta inválido'),
  handleValidationErrors
];

const validateTasacion = [
  body('tituloPropiedad').trim().isLength({ min: 5, max: 255 }).withMessage('El título debe tener entre 5 y 255 caracteres'),
  body('direccionPropiedad').trim().isLength({ min: 5, max: 500 }).withMessage('La dirección debe tener entre 5 y 500 caracteres'),
  body('tipoPropiedad').isIn(['Casa', 'Apartamento', 'Local', 'Terreno', 'Oficina', 'Depósito']).withMessage('Tipo de propiedad inválido'),
  body('habitaciones').optional().isInt({ min: 0, max: 20 }).withMessage('Las habitaciones deben ser un número entre 0 y 20'),
  body('banos').optional().isInt({ min: 0, max: 10 }).withMessage('Los baños deben ser un número entre 0 y 10'),
  body('superficieM2').optional().isFloat({ min: 0, max: 10000 }).withMessage('La superficie debe estar entre 0 y 10000 m²'),
  body('nombreSolicitante').optional().trim().isLength({ max: 255 }).withMessage('El nombre no puede exceder 255 caracteres'),
  body('emailSolicitante').optional().isEmail().normalizeEmail().withMessage('Email inválido'),
  handleValidationErrors
];

const validateId = [
  param('id').isMongoId().withMessage('ID inválido'),
  handleValidationErrors
];

const validateSearch = [
  query('precioMin').optional().isFloat({ min: 0 }).withMessage('El precio mínimo debe ser mayor o igual a 0'),
  query('precioMax').optional().isFloat({ min: 0 }).withMessage('El precio máximo debe ser mayor o igual a 0'),
  query('habitacionesMin').optional().isInt({ min: 0 }).withMessage('Las habitaciones mínimas deben ser un número entero mayor o igual a 0'),
  query('banosMin').optional().isInt({ min: 0 }).withMessage('Los baños mínimos deben ser un número entero mayor o igual a 0'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateProperty,
  validateClient,
  validateReservation,
  validateContact,
  validateTasacion,
  validateId,
  validateSearch
};