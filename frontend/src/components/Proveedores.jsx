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
  Grid
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
  ContactPhone as ContactPhoneIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
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
    setEditandoProveedor(null);
    setMostrarFormulario(true);
  };

  const abrirFormularioEditar = (proveedor) => {
    setFormData({
      nombre: proveedor.nombre || '',
      telefono: proveedor.telefono || '',
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
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

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
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Distribuidora ABC S.A."
                InputProps={{
                  startAdornment: <BusinessIcon sx={{ mr: 1, color: 'grey.500' }} />
                }}
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nombre del Contacto"
                    variant="outlined"
                    value={formData.contacto}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: 'grey.500' }} />
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Teléfono"
                    variant="outlined"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Ej: +52 123 456 7890"
                    InputProps={{
                      startAdornment: <PhoneIcon sx={{ mr: 1, color: 'grey.500' }} />
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
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@empresa.com"
                InputProps={{
                  startAdornment: <EmailIcon sx={{ mr: 1, color: 'grey.500' }} />
                }}
              />

              <TextField
                fullWidth
                label="Dirección"
                variant="outlined"
                multiline
                rows={3}
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Calle, número, colonia, ciudad..."
                InputProps={{
                  startAdornment: <LocationIcon sx={{ mr: 1, color: 'grey.500', alignSelf: 'flex-start', mt: 1 }} />
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
              disabled={loading}
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