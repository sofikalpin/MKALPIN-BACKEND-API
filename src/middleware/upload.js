const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

console.log('Configurando Cloudinary con las siguientes credenciales:');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '*** Configurado ***' : 'No configurado');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '*** Configurado ***' : 'No configurado');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '*** Configurado ***' : 'No configurado');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

cloudinary.api.ping()
  .then(() => console.log('Conexión exitosa con Cloudinary'))
  .catch(err => console.error('Error conectando con Cloudinary:', err.message));

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    try {
      let folder = 'mkalpin/usuarios';
      let resource_type = 'image';
      const originalUrl = req.originalUrl || '';

      console.log('\n--- Iniciando subida de archivo ---');
      console.log('URL de la solicitud:', originalUrl);
      console.log('Nombre del archivo:', file.originalname);
      console.log('Tipo MIME:', file.mimetype);
      console.log('ID de usuario:', req.user?._id || 'No autenticado');

      if (originalUrl.includes('/Usuario/SubirFotoPerfil') || originalUrl.includes('/Usuario/ActualizarFoto')) {
        let userId = req.user?._id;
        if (!userId) {
          if (!req.usuarioUploadTempId) {
            req.usuarioUploadTempId = `temp-${Date.now()}`;
          }
          userId = req.usuarioUploadTempId;
        }
        folder = `mkalpin/usuarios/${userId}`;
        console.log(`Subiendo imagen de perfil a la carpeta: ${folder}`);
      }
      else if (originalUrl.includes('/Propiedad/')) {
        folder = `mkalpin/propiedades/${req.params.id || 'temp'}`;
      } else if (originalUrl.includes('/Cliente/')) {
        folder = `mkalpin/clientes/${req.params.id || 'temp'}`;
      } else if (originalUrl.includes('/Tasacion/') || originalUrl.includes('/Appraise/') || originalUrl.includes('/API/Tasacion/')) {
        let tasacionId = req.params?.id;
        if (!tasacionId) {
          if (!req.tasacionUploadTempId) {
            req.tasacionUploadTempId = `${Date.now()}`;
          }
          tasacionId = req.tasacionUploadTempId;
        }
        folder = `mkalpin/tasaciones/${tasacionId}`;
      } else {
        folder = 'mkalpin/general';
      }

      const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
      const allowedDocumentTypes = /pdf|doc|docx|xls|xlsx/;
      const ext = path.extname(file.originalname).toLowerCase();

      if (allowedImageTypes.test(ext)) {
        resource_type = 'image';
      } else if (allowedDocumentTypes.test(ext)) {
        resource_type = 'raw';
      }

      const params = {
        folder: folder,
        resource_type: resource_type,
        quality: 'auto:good',
        width: 1920,
        height: 1080,
        crop: 'limit',
        public_id: `${Date.now()}-${path.parse(file.originalname).name}`
      };

      console.log('Parámetros de Cloudinary:', JSON.stringify(params, null, 2));
      return params;
    } catch (error) {
      console.error('Error en la configuración de Cloudinary Storage:', error);
      throw error;
    }
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedDocumentTypes = /pdf|doc|docx|xls|xlsx/;

  const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) ||
    allowedDocumentTypes.test(path.extname(file.originalname).toLowerCase());

  if (extname) {
    return cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido.'));
  }
};

const uploadProfilePicture = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  }
});

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 10
  }
});

upload.any = function () {
  return function (req, res, next) {
    console.log('\n--- Multer Middleware ---');
    console.log('Método:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
      console.log('\n--- Respuesta del servidor ---');
      console.log('Status Code:', res.statusCode);
      if (chunk) {
        try {
          const body = JSON.parse(chunk.toString());
          console.log('Response Body:', JSON.stringify(body, null, 2));
        } catch (e) {
          console.log('Response Body:', chunk && chunk.toString());
        }
      }
      originalEnd.apply(res, arguments);
    };

    multer({
      storage: storage,
      fileFilter: fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10
      }
    }).apply(this, arguments)(req, res, function (err) {
      if (err) {
        console.error('Error en multer:', err);
        return next(err);
      }
      next();
    });
  };
};

const deleteFile = async (public_id) => {
  if (!public_id) return;

  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
  }
};

const deleteDirectory = async (folderPath) => {
  try {
    await cloudinary.api.delete_resources_by_prefix(folderPath);
    await cloudinary.api.delete_folder(folderPath);
  } catch (error) {
    console.error("Error deleting directory from Cloudinary:", error);
  }
};

const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ status: false, message: 'El archivo es demasiado grande. Máximo: 25MB' });
    }
  }
  if (error.message.includes('Tipo de archivo no permitido')) {
    return res.status(400).json({ status: false, message: error.message });
  }
  next(error);
};

module.exports = {
  upload,
  uploadProfilePicture,
  uploadPropertyImages: upload.array('imagenes', 10),
  uploadTasacionImages: upload.array('imagenes', 5),

  deleteFile,
  deleteDirectory,

  handleMulterError
};