const Usuario = require('../models/Usuario');
const notificationMiddleware = require('../middlewares/notificationMiddleware');

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
      
      if (!nombre || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, email y password son requeridos',
          data: { nombre, email, rol }
        });
      }
      
      const usuario = new Usuario(null, nombre.trim(), email.trim(), password, rol || '');
      await usuario.guardar();
      
      const usuarioRespuesta = {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        fecha_creacion: usuario.fecha_creacion
      };

      // Notificar al administrador sobre nuevo usuario
      if (req.user && req.user.rol === 'admin') {
        await notificationMiddleware.onUserDataModified(
          req.user.userId,
          usuario.id,
          { tipo: 'nuevo_usuario', mensaje: `Nuevo usuario creado: ${usuario.nombre}` }
        );
      }
      
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
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario inválido'
        });
      }
      
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
      
      // Guardar datos antiguos para la notificación
      const datosAntiguos = {
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      };
      
      usuario.nombre = nombre.trim();
      usuario.email = email.trim();
      usuario.rol = rol || usuario.rol;
      
      await usuario.actualizar();

      // Verificar si req.user existe antes de usarlo
      if (req.user && req.user.userId) {
        await notificationMiddleware.onUserDataModified(
          req.user.userId,
          usuario.id,
          { 
            tipo: 'actualizacion_perfil',
            cambios: {
              nombre: { de: datosAntiguos.nombre, a: usuario.nombre },
              email: { de: datosAntiguos.email, a: usuario.email },
              rol: { de: datosAntiguos.rol, a: usuario.rol }
            },
            administrador: req.user.nombre || 'Sistema'
          }
        );
      }
      
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
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }
    
    const usuarioId = parseInt(id);
    
    // Verificar si el usuario existe
    const usuario = await Usuario.obtenerPorId(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar si el usuario que elimina es el mismo que se va a eliminar
    if (req.user && req.user.userId === usuarioId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta'
      });
    }

    // Guardar información para la notificación
    const usuarioEliminado = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email
    };

    // Usar el nuevo método eliminarCompleto que maneja dependencias
    const eliminado = await Usuario.eliminarCompleto(usuarioId);
    
    if (!eliminado) {
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar usuario'
      });
    }

    // Notificar a administradores sobre eliminación
    if (req.user && req.user.userId) {
      await notificationMiddleware.onUserDataModified(
        req.user.userId,
        usuarioId,
        { 
          tipo: 'usuario_eliminado',
          usuario: usuarioEliminado,
          eliminado_por: req.user.nombre || 'Sistema'
        }
      );
    }
    
    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
      data: { id: usuarioId }
    });
    
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    
    // Manejar error de clave foránea específicamente
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el usuario porque tiene datos relacionados',
        error: 'El usuario tiene notificaciones u otros datos asociados que deben eliminarse primero',
        code: 'FOREIGN_KEY_VIOLATION'
      });
    }
    
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
