# Backend API - Mkalpin Negocios Inmobiliarios

Este es el backend de la aplicación para Mkalpin Negocios Inmobiliarios, desarrollado con Node.js y MongoDB. Proporciona una API RESTful para gestionar operaciones inmobiliarias.

## Tecnologías Utilizadas

- **Node.js**: Entorno de ejecución para JavaScript del lado del servidor.
- **Express.js**: Framework web para Node.js.
- **MongoDB**: Base de datos NoSQL.
- **Mongoose**: ODM para MongoDB.
- **JWT**: Para autenticación basada en tokens.
- **Bcrypt**: Para el hashing de contraseñas.
- **Multer**: Para el manejo de archivos (imágenes).
- **Nodemailer**: Para el envío de correos electrónicos.
- **CORS**: Para manejar políticas de origen cruzado.
- **Helmet**: Para seguridad de la aplicación.
- **Express Rate Limit**: Para limitar tasas de solicitud.
- **Morgan**: Para logging de solicitudes HTTP.

## Instalación

1. Clona el repositorio:
   ```bash
   git clone <url-del-repositorio>
   cd backend-mkalpinni
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura las variables de entorno:
   - Crea un archivo `.env` basado en `.env` (asegúrate de configurar las credenciales de MongoDB, JWT, etc.)

4. Ejecuta el servidor:
   ```bash
   npm start  # Para producción
   npm run dev  # Para desarrollo con nodemon
   ```

## Uso

Una vez que el servidor esté corriendo, puedes acceder a la API en `http://localhost:3000` (o el puerto configurado).

### Scripts Disponibles

- `npm start`: Inicia el servidor en modo producción.
- `npm run dev`: Inicia el servidor en modo desarrollo con recarga automática.
- `npm test`: Ejecuta las pruebas con Jest.
- `npm run seed`: Ejecuta el script de seed para poblar la base de datos.

## Estructura del Proyecto

- `src/`: Código fuente de la aplicación.
- `scripts/`: Scripts útiles, como `seedDatabase.js`.
- `uploads/`: Carpeta para archivos subidos (imágenes, etc.).
- `server.js`: Punto de entrada de la aplicación.

## Autenticación

La API utiliza JWT para autenticar usuarios. Asegúrate de enviar el token en el header `Authorization` como `Bearer <token>`.

## Endpoints Principales

- **POST /api/auth/login**: Iniciar sesión.
- **POST /api/auth/register**: Registrar un nuevo usuario.
- **GET /api/properties**: Obtener propiedades inmobiliarias.
- **POST /api/properties**: Crear una nueva propiedad (requiere autenticación).


## Contribución

1. Haz fork del proyecto.
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`).
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`).
4. Push a la rama (`git push origin feature/AmazingFeature`).
5. Abre un Pull Request.

## Licencia

Este proyecto es privado y pertenece a Mkalpin Negocios Inmobiliarios.