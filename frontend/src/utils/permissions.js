// Sistema de permisos por rol
export const PERMISOS = {
  lector: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false
  },
  editor: {
    ver: true,
    crear: true,
    editar: true,
    eliminar: false
  },
  admin: {
    ver: true,
    crear: true,
    editar: true,
    eliminar: true
  }
};

// Función para verificar permisos
export const tienePermiso = (userRole, accion) => {
  if (!userRole) return false;
  return PERMISOS[userRole]?.[accion] || false;
};