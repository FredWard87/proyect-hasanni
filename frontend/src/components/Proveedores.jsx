import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  AppBar,
  Toolbar,
  Tooltip,
  Avatar,
  Divider,
  Grid,
  InputAdornment,
  Collapse,
  AlertTitle
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  ContactPhone as ContactPhoneIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Configuración de validaciones
const VALIDACIONES = {
  nombre: {
    minLength: 2,
    maxLength: 400,
    pattern: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s\-\&\.\,\(\)\d]+$/,
    mensajeError: 'El nombre debe contener solo letras, números, espacios y los siguientes caracteres: - & . , ( )',
    placeholder: 'Ej: Distribuidora ABC S.A. (2-100 caracteres)'
  },
  contacto: {
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s\.]+$/,
    mensajeError: 'El nombre de contacto debe contener solo letras y espacios',
    placeholder: 'Ej: Juan Pérez (2-50 caracteres)'
  },
 telefono: {
  minLength: 7, 
  maxLength: 12,
  pattern: /^\+\d{1,4}\d{7,12}$/,
  mensajeError: 'El teléfono debe tener entre 7 y 12 dígitos después de la lada',
  placeholder: 'Selecciona lada y escribe teléfono'
},
  email: {
    minLength: 5,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    mensajeError: 'El formato del email no es válido',
    placeholder: 'contacto@empresa.com (5-100 caracteres)'
  },
  direccion: {
    minLength: 5,
    maxLength: 200,
    pattern: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s\-\#\.\,\d]+$/,
    mensajeError: 'La dirección debe contener solo letras, números, espacios y los caracteres: - # . ,',
    placeholder: 'Calle, número, colonia, ciudad... (5-200 caracteres)'
  }
};



// Función de validación robusta
const validarCampo = (campo, valor) => {
  const config = VALIDACIONES[campo];
  if (!config) return { valido: true, mensaje: '' };

  // Si el campo es opcional y está vacío, es válido
  if (!valor.trim() && campo !== 'nombre') {
    return { valido: true, mensaje: '' };
  }

  // Validar longitud mínima
  if (valor.length < config.minLength) {
    return { 
      valido: false, 
      mensaje: `Mínimo ${config.minLength} caracteres requeridos` 
    };
  }

  // Validar longitud máxima
  if (valor.length > config.maxLength) {
    return { 
      valido: false, 
      mensaje: `Máximo ${config.maxLength} caracteres permitidos` 
    };
  }

  // En la función validarCampo, para el caso del teléfono:
if (campo === 'telefono' && valor.trim()) {
  // Remover espacios para validar
  const telefonoLimpio = valor.replace(/\s/g, '');
  
  // Validar que empiece con +52 y tenga exactamente 10 dígitos después
  
}

  // Validar patrón si existe
  if (config.pattern && !config.pattern.test(valor)) {
    return { 
      valido: false, 
      mensaje: config.mensajeError 
    };
  }



  return { valido: true, mensaje: '' };
};

// Función para sanitizar entrada
const sanitizarEntrada = (valor, maxLength = 100) => {
  if (typeof valor !== 'string') return '';
  
  // Remover caracteres especiales peligrosos
  let sanitized = valor
    .replace(/[<>]/g, '') // Remover < y >
    .replace(/javascript:/gi, '') // Remover javascript:
    .replace(/on\w+=/gi, '') // Remover eventos como onclick, onload, etc.
    .replace(/'/g, '') // Remover comillas simples
    .replace(/"/g, ''); // Remover comillas dobles
  
  // Limitar longitud
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
};

const Proveedores = () => {
  const navigate = useNavigate();
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoProveedor, setEditandoProveedor] = useState(null);
const [formData, setFormData] = useState({
  nombre: '',
  telefono: '', // Teléfono completo (lada + número)
  lada: '+52',  // Lada por separado
  numeroTelefono: '', // Solo el número sin lada
  contacto: '',
  email: '',
  direccion: ''
});

  // Estados de validación
  const [erroresValidacion, setErroresValidacion] = useState({
    nombre: '',
    telefono: '',
    contacto: '',
    email: '',
    direccion: ''
  });

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/inventario/proveedores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setProveedores(response.data.data);
        setError(null);
      } else {
        setError(response.data.message || 'Error al cargar proveedores');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const mostrarMensaje = (mensaje, tipo) => {
    if (tipo === 'success') {
      setSuccess(mensaje);
      setTimeout(() => setSuccess(null), 5000);
    } else {
      setError(mensaje);
      setTimeout(() => setError(null), 5000);
    }
  };

  // Función de validación en tiempo real
  const validarCampoEnTiempoReal = (campo, valor) => {
    const resultado = validarCampo(campo, valor);
    setErroresValidacion(prev => ({
      ...prev,
      [campo]: resultado.mensaje
    }));
    return resultado.valido;
  };

  // Manejar cambio en los campos con validación
  const handleCampoChange = (campo, valor) => {
    // Sanitizar entrada
    const valorSanitizado = sanitizarEntrada(valor, VALIDACIONES[campo]?.maxLength || 100);
    
    // Validar en tiempo real
    validarCampoEnTiempoReal(campo, valorSanitizado);
    
    // Actualizar estado
    setFormData(prev => ({
      ...prev,
      [campo]: valorSanitizado
    }));
  };

  // Validar formulario completo
  const validarFormulario = () => {
    const nuevosErrores = {};
    let esValido = true;

    // Validar nombre (obligatorio)
    const nombreValido = validarCampoEnTiempoReal('nombre', formData.nombre);
    if (!nombreValido) {
      nuevosErrores.nombre = erroresValidacion.nombre;
      esValido = false;
    }

    // Validar contacto (opcional)
    if (formData.contacto.trim()) {
      const contactoValido = validarCampoEnTiempoReal('contacto', formData.contacto);
      if (!contactoValido) {
        nuevosErrores.contacto = erroresValidacion.contacto;
        esValido = false;
      }
    }

    // Validar teléfono (opcional)
    if (formData.telefono.trim()) {
      const telefonoValido = validarCampoEnTiempoReal('telefono', formData.telefono);
      if (!telefonoValido) {
        nuevosErrores.telefono = erroresValidacion.telefono;
        esValido = false;
      }
    }

    // Validar email (opcional)
    if (formData.email.trim()) {
      const emailValido = validarCampoEnTiempoReal('email', formData.email);
      if (!emailValido) {
        nuevosErrores.email = erroresValidacion.email;
        esValido = false;
      }
    }

    // Validar dirección (opcional)
    if (formData.direccion.trim()) {
      const direccionValido = validarCampoEnTiempoReal('direccion', formData.direccion);
      if (!direccionValido) {
        nuevosErrores.direccion = erroresValidacion.direccion;
        esValido = false;
      }
    }

    setErroresValidacion(nuevosErrores);
    return esValido;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar formulario antes de enviar
    if (!validarFormulario()) {
      mostrarMensaje('Por favor corrige los errores en el formulario', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (editandoProveedor) {
        const response = await axios.put(
          `${API_URL}/inventario/proveedores/${editandoProveedor.id_proveedor}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          mostrarMensaje('Proveedor actualizado exitosamente', 'success');
          setEditandoProveedor(null);
        } else {
          mostrarMensaje(response.data.message || 'Error al actualizar proveedor', 'error');
        }
      } else {
        const response = await axios.post(
          `${API_URL}/inventario/proveedores`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          mostrarMensaje('Proveedor creado exitosamente', 'success');
        } else {
          mostrarMensaje(response.data.message || 'Error al crear proveedor', 'error');
        }
      }
      
      await cargarProveedores();
      cerrarFormulario();
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.errors?.join(', ') || 'Error al guardar proveedor';
      mostrarMensaje(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const abrirFormularioNuevo = () => {
    setFormData({
      nombre: '',
      telefono: '',
      contacto: '',
      email: '',
      direccion: ''
    });
    setErroresValidacion({
      nombre: '',
      telefono: '',
      contacto: '',
      email: '',
      direccion: ''
    });
    setEditandoProveedor(null);
    setMostrarFormulario(true);
  };

  const abrirFormularioEditar = (proveedor) => {
  let lada = '+52';
  let numeroTelefono = '';
  
  if (proveedor.telefono) {
    // Extraer lada y número del teléfono existente
    const match = proveedor.telefono.match(/^(\+\d+)(\d+)$/);
    if (match) {
      lada = match[1];
      numeroTelefono = match[2];
    }
  }
  
  setFormData({
    nombre: proveedor.nombre || '',
    telefono: proveedor.telefono || '',
    lada: lada,
    numeroTelefono: numeroTelefono,
    contacto: proveedor.contacto || '',
    email: proveedor.email || '',
    direccion: proveedor.direccion || ''
  });
    setEditandoProveedor(proveedor);
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setEditandoProveedor(null);
    setFormData({
      nombre: '',
      telefono: '',
      contacto: '',
      email: '',
      direccion: ''
    });
    setErroresValidacion({
      nombre: '',
      telefono: '',
      contacto: '',
      email: '',
      direccion: ''
    });
  };

  const getInitials = (nombre) => {
    if (!nombre) return '??';
    return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Función para obtener el color del borde del campo según la validación
  const getBorderColor = (campo) => {
    if (erroresValidacion[campo]) return 'error.main';
    if (formData[campo] && !erroresValidacion[campo]) return 'success.main';
    return 'grey.400';
  };

  // Función para obtener el icono de validación
  const getValidationIcon = (campo) => {
    if (erroresValidacion[campo]) {
      return <ErrorIcon color="error" fontSize="small" />;
    }
    if (formData[campo] && !erroresValidacion[campo]) {
      return <CheckCircleIcon color="success" fontSize="small" />;
    }
    return null;
  };

  // Función para obtener el texto de ayuda del campo
  const getHelperText = (campo) => {
    const config = VALIDACIONES[campo];
    if (!config) return '';
    
    if (erroresValidacion[campo]) {
      return erroresValidacion[campo];
    }
    
    const length = formData[campo]?.length || 0;
    const maxLength = config.maxLength;
    
    if (campo === 'nombre') {
      return `${length}/${maxLength} caracteres (requerido)`;
    }
    
    return length > 0 ? `${length}/${maxLength} caracteres` : '(opcional)';
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }} elevation={2}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate(-1)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <BusinessIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Gestión de Proveedores
          </Typography>
          <Tooltip title="Actualizar">
            <IconButton color="inherit" onClick={cargarProveedores}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Collapse in={!!error}>
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3, borderRadius: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        </Collapse>

        <Collapse in={!!success}>
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 3, borderRadius: 2 }}>
            <AlertTitle>Éxito</AlertTitle>
            {success}
          </Alert>
        </Collapse>

        {/* Header con estadísticas */}
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={8}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  Proveedores Registrados
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Administra la información de tus proveedores
                </Typography>
              </Grid>
              <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                <Box sx={{ display: 'inline-block', bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, p: 2 }}>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    {proveedores.length}
                  </Typography>
                  <Typography variant="body2">Total de Proveedores</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Botón para agregar */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={abrirFormularioNuevo}
            disabled={loading}
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.5,
              boxShadow: 3
            }}
          >
            Nuevo Proveedor
          </Button>
        </Box>

        {/* Tabla de proveedores */}
        <Card elevation={0} sx={{ borderRadius: 3, border: 1, borderColor: 'divider' }}>
          {loading && proveedores.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : proveedores.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <BusinessIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No hay proveedores registrados
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Comienza agregando tu primer proveedor
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={abrirFormularioNuevo}
              >
                Agregar Proveedor
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Proveedor</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Contacto</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Información</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Fecha Registro</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Estado</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {proveedores.map((proveedor) => (
                    <TableRow key={proveedor.id_proveedor} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {getInitials(proveedor.nombre)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {proveedor.nombre}
                            </Typography>
                            {proveedor.direccion && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LocationIcon fontSize="small" sx={{ color: 'grey.500', fontSize: 16 }} />
                                <Typography variant="caption" color="text.secondary">
                                  {proveedor.direccion}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {proveedor.contacto && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <PersonIcon fontSize="small" sx={{ color: 'grey.500' }} />
                            <Typography variant="body2">{proveedor.contacto}</Typography>
                          </Box>
                        )}
                        {proveedor.telefono && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon fontSize="small" sx={{ color: 'grey.500' }} />
                            <Typography variant="body2">{proveedor.telefono}</Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        {proveedor.email ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon fontSize="small" sx={{ color: 'grey.500' }} />
                            <Typography variant="body2">{proveedor.email}</Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Sin email
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatearFecha(proveedor.fecha_registro)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={proveedor.activo ? 'Activo' : 'Inactivo'}
                          color={proveedor.activo ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => abrirFormularioEditar(proveedor)}
                              sx={{ color: 'primary.main' }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </Container>

      {/* Modal de formulario */}
      <Dialog
        open={mostrarFormulario}
        onClose={cerrarFormulario}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {editandoProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {editandoProveedor ? 'Modifica los datos del proveedor' : 'Completa la información del nuevo proveedor'}
          </Typography>
        </DialogTitle>

        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Nombre de la Empresa"
                variant="outlined"
                required
                value={formData.nombre}
                onChange={(e) => handleCampoChange('nombre', e.target.value)}
                placeholder={VALIDACIONES.nombre.placeholder}
                error={!!erroresValidacion.nombre}
                helperText={getHelperText('nombre')}
                inputProps={{ 
                  maxLength: VALIDACIONES.nombre.maxLength,
                  pattern: VALIDACIONES.nombre.pattern.source
                }}
                InputProps={{
                  startAdornment: <BusinessIcon sx={{ mr: 1, color: 'grey.500' }} />,
                  endAdornment: getValidationIcon('nombre')
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: getBorderColor('nombre'),
                    },
                  }
                }}
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nombre del Contacto"
                    variant="outlined"
                    value={formData.contacto}
                    onChange={(e) => handleCampoChange('contacto', e.target.value)}
                    placeholder={VALIDACIONES.contacto.placeholder}
                    error={!!erroresValidacion.contacto}
                    helperText={getHelperText('contacto')}
                    inputProps={{ 
                      maxLength: VALIDACIONES.contacto.maxLength,
                      pattern: VALIDACIONES.contacto.pattern.source
                    }}
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: 'grey.500' }} />,
                      endAdornment: getValidationIcon('contacto')
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '&.Mui-focused fieldset': {
                          borderColor: getBorderColor('contacto'),
                        },
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
        <TextField
  fullWidth
  label="Teléfono"
  variant="outlined"
  value={formData.numeroTelefono || ''} // Solo el número sin lada
  onChange={(e) => {
    const valor = e.target.value;
    // Permitir solo números, máximo 10 dígitos
    const soloNumeros = valor.replace(/\D/g, '').slice(0, 10);
    handleCampoChange('numeroTelefono', soloNumeros);
    
    // Actualizar el teléfono completo automáticamente
    const ladaActual = formData.lada || '+52';
    const telefonoCompleto = ladaActual + soloNumeros;
    handleCampoChange('telefono', telefonoCompleto);
  }}
  placeholder="1234567890"
  error={!!erroresValidacion.telefono}
  helperText={erroresValidacion.telefono || (formData.numeroTelefono ? `${formData.numeroTelefono.length}/10 dígitos` : 'Escribe 10 dígitos')}
  inputProps={{ 
    maxLength: 10,
    inputMode: 'numeric'
  }}
  InputProps={{
    startAdornment: (
      <InputAdornment position="start">
        <PhoneIcon sx={{ color: 'grey.500', mr: 1 }} />
        <TextField
          select
          variant="standard"
          value={formData.lada || '+52'}
          onChange={(e) => {
            const nuevaLada = e.target.value;
            handleCampoChange('lada', nuevaLada);
            
            // Actualizar el teléfono completo con la nueva lada
            const numeroActual = formData.numeroTelefono || '';
            const telefonoCompleto = nuevaLada + numeroActual;
            handleCampoChange('telefono', telefonoCompleto);
          }}
          sx={{
            minWidth: 100,
            '& .MuiInput-underline:before': { borderBottom: 'none' },
            '& .MuiInput-underline:after': { borderBottom: 'none' },
            '& .MuiSelect-select': { 
              paddingRight: '24px !important',
              paddingLeft: '8px !important'
            }
          }}
          SelectProps={{
            native: true,
          }}
        >
          <option value="+52">🇲🇽 +52</option>
          <option value="+1">🇺🇸 +1</option>
          <option value="+34">🇪🇸 +34</option>
          <option value="+51">🇵🇪 +51</option>
          <option value="+56">🇨🇱 +56</option>
          <option value="+54">🇦🇷 +54</option>
          <option value="+55">🇧🇷 +55</option>
          <option value="+57">🇨🇴 +57</option>
          <option value="+58">🇻🇪 +58</option>
          <option value="+503">🇸🇻 +503</option>
          <option value="+504">🇭🇳 +504</option>
          <option value="+505">🇳🇮 +505</option>
          <option value="+506">🇨🇷 +506</option>
          <option value="+507">🇵🇦 +507</option>
          <option value="+44">🇬🇧 +44</option>
          <option value="+33">🇫🇷 +33</option>
          <option value="+49">🇩🇪 +49</option>
          <option value="+39">🇮🇹 +39</option>
        </TextField>
      </InputAdornment>
    ),
    endAdornment: getValidationIcon('telefono'),
  }}
  sx={{
    '& .MuiOutlinedInput-root': {
      '&.Mui-focused fieldset': {
        borderColor: getBorderColor('telefono'),
      },
    }
  }}
/>
                </Grid>
              </Grid>

              <TextField
                fullWidth
                label="Email"
                type="email"
                variant="outlined"
                value={formData.email}
                onChange={(e) => handleCampoChange('email', e.target.value)}
                placeholder={VALIDACIONES.email.placeholder}
                error={!!erroresValidacion.email}
                helperText={getHelperText('email')}
                inputProps={{ 
                  maxLength: VALIDACIONES.email.maxLength,
                  pattern: VALIDACIONES.email.pattern.source
                }}
                InputProps={{
                  startAdornment: <EmailIcon sx={{ mr: 1, color: 'grey.500' }} />,
                  endAdornment: getValidationIcon('email')
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: getBorderColor('email'),
                    },
                  }
                }}
              />

              <TextField
                fullWidth
                label="Dirección"
                variant="outlined"
                multiline
                rows={3}
                value={formData.direccion}
                onChange={(e) => handleCampoChange('direccion', e.target.value)}
                placeholder={VALIDACIONES.direccion.placeholder}
                error={!!erroresValidacion.direccion}
                helperText={getHelperText('direccion')}
                inputProps={{ 
                  maxLength: VALIDACIONES.direccion.maxLength,
                  pattern: VALIDACIONES.direccion.pattern.source
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                      <LocationIcon sx={{ color: 'grey.500' }} />
                    </InputAdornment>
                  ),
                  endAdornment: getValidationIcon('direccion')
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: getBorderColor('direccion'),
                    },
                  }
                }}
              />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 2 }}>
            <Button
              onClick={cerrarFormulario}
              startIcon={<CloseIcon />}
              sx={{ mr: 1 }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
              disabled={loading || Object.values(erroresValidacion).some(error => error !== '') || !formData.nombre.trim()}
              sx={{ borderRadius: 2 }}
            >
              {editandoProveedor ? 'Actualizar' : 'Crear Proveedor'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Proveedores;
