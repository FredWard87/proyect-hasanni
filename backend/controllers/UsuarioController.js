const Usuario = require('../models/Usuario');

class UsuarioController {
  
  // GET /api/usuarios - Obtener todos los usuarios
  static async obtenerUsuarios(req, res) {
    try {
      const usuarios = await Usuario.obtenerTodos();
      const estadisticas = await Usuario.obtenerEstadisticasPorRol();
      
      res.json({
        success: true,
        data: usuarios,
        estadisticas: estadisticas,
        total: usuarios.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener la lista de usuarios',
        error: error.message
      });
    }
  }

  // GET /api/usuarios/:id - Obtener usuario por ID
  static async obtenerUsuarioPorId(req, res) {
    try {
      const { id } = req.params;
      
      // Validar que el ID sea un número
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }
      
      const usuario = await Usuario.obtenerPorId(parseInt(id));
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: usuario
      });
      
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuario',
        error: error.message
      });
    }
  }

  // POST /api/usuarios - Crear nuevo usuario
  static async crearUsuario(req, res) {
    try {
      const { nombre, email, password, rol } = req.body;
      
      // Validar datos requeridos
      if (!nombre || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, email y password son requeridos',
          data: { nombre, email, rol }
        });
      }
      
      // Crear nueva instancia de usuario
      const usuario = new Usuario(null, nombre.trim(), email.trim(), password, rol || '');
      
      // Guardar en base de datos
      await usuario.guardar();
      
      // Retornar usuario creado (sin password)
      const usuarioRespuesta = {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        fecha_creacion: usuario.fecha_creacion
      };
      
      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: usuarioRespuesta
      });
      
    } catch (error) {
      console.error('Error al crear usuario:', error);
      res.status(400).json({
        success: false,
        message: error.message,
        data: {
          nombre: req.body.nombre,
          email: req.body.email,
          rol: req.body.rol
        }
      });
    }
  }

  // PUT /api/usuarios/:id - Actualizar usuario
  static async actualizarUsuario(req, res) {
    try {
      const { id } = req.params;
      const { nombre, email, rol } = req.body;
      
      // Validar ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }
      
      // Validar datos requeridos
      if (!nombre || !email) {
        return res.status(400).json({
          success: false,
          message: 'Nombre y email son requeridos'
        });
      }
      
      const usuario = await Usuario.obtenerPorId(parseInt(id));
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Actualizar campos
      usuario.nombre = nombre.trim();
      usuario.email = email.trim();
      usuario.rol = rol || usuario.rol;
      
      // Guardar cambios
      await usuario.actualizar();
      
      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          fecha_creacion: usuario.fecha_creacion
        }
      });
      
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // DELETE /api/usuarios/:id - Eliminar usuario
  static async eliminarUsuario(req, res) {
    try {
      const { id } = req.params;
      
      // Validar ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }
      
      const usuario = await Usuario.obtenerPorId(parseInt(id));
      
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      await usuario.eliminar();
      
      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente',
        data: { id: parseInt(id) }
      });
      
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar usuario',
        error: error.message
      });
    }
  }

  // GET /api/usuarios/roles - Obtener roles válidos
  static obtenerRoles(req, res) {
    res.json({
      success: true,
      data: Usuario.ROLES_VALIDOS,
      descriptions: {
        admin: 'Acceso completo al sistema',
        editor: 'Puede crear y editar contenido',
        lector: 'Solo puede leer contenido'
      }
    });
  }

  // GET /api/usuarios/estadisticas - Obtener estadísticas
  static async obtenerEstadisticas(req, res) {
    try {
      const estadisticas = await Usuario.obtenerEstadisticasPorRol();
      const usuarios = await Usuario.obtenerTodos();
      
      res.json({
        success: true,
        data: {
          por_rol: estadisticas,
          total_usuarios: usuarios.length,
          ultimo_usuario: usuarios.length > 0 ? usuarios[0] : null
        }
      });
      
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  }

  // GET /api/health - Health check del API
  static healthCheck(req, res) {
    res.json({
      success: true,
      message: 'API funcionando correctamente',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  }
}

module.exports = UsuarioController;