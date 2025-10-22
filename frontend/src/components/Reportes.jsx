import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  Stack,
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Badge,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Download as DownloadIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Category as CategoryIcon,
  Timeline as TimelineIcon,
  Inventory as InventoryIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  TableChart as ExcelIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  FilterList as FilterListIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  RestoreFromTrash as RestoreIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Paleta de colores profesional
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF6B9D', '#C39BD3', '#76D7C4'
];

const Reportes = () => {
  const [tabActual, setTabActual] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados para reportes
  const [reporteCategorias, setReporteCategorias] = useState([]);
  const [reporteMovimientos, setReporteMovimientos] = useState([]);
  const [reporteTopProductos, setReporteTopProductos] = useState([]);
  const [alertasStock, setAlertasStock] = useState([]);
  const [inventarioCompleto, setInventarioCompleto] = useState([]);
  
  // Estados para filtros
  const [filtroStock, setFiltroStock] = useState('todos');
  const [filtroActivo, setFiltroActivo] = useState('todos');

  // Estados para modal de productos por categoría
  const [modalCategoria, setModalCategoria] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [productosPorCategoria, setProductosPorCategoria] = useState([]);

  // Estados para modal de crear/editar producto
  const [modalProducto, setModalProducto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [formProducto, setFormProducto] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    stock: 0,
    categoria: '',
    unidad: 'unidad',
    stock_minimo: 0,
    precio: 0
  });

  // Estados para filtros de reportes
  const [fechaInicio, setFechaInicio] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [diasTopProductos, setDiasTopProductos] = useState(30);
  const [limiteProductos, setLimiteProductos] = useState(10);

  useEffect(() => {
    cargarReporteCategorias();
    cargarAlertasStock();
    cargarInventarioCompleto();
  }, []);

  const cargarInventarioCompleto = async () => {
    try {
      const token = localStorage.getItem('token');
      // CAMBIO: Usar la ruta /pagos/productos que sí funciona correctamente
      const response = await axios.get(`${API_URL}/pagos/productos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        console.log('📦 Inventario cargado desde /pagos/productos:', response.data.data);
        setInventarioCompleto(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando inventario:', err);
      // Fallback: intentar con la ruta original
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/inventario`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          console.log('📦 Inventario cargado desde /inventario:', response.data.data);
          setInventarioCompleto(response.data.data);
        }
      } catch (fallbackErr) {
        console.error('Error cargando inventario fallback:', fallbackErr);
      }
    }
  };

  const cargarReporteCategorias = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/reportes/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setReporteCategorias(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando reporte de categorías:', err);
      setError('Error al cargar el reporte de categorías');
    } finally {
      setLoading(false);
    }
  };

  const cargarReporteMovimientos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/reportes/movements-by-period?startDate=${fechaInicio}&endDate=${fechaFin}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setReporteMovimientos(response.data.data);
        setSuccess('Reporte de movimientos cargado exitosamente');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Error cargando reporte de movimientos:', err);
      setError('Error al cargar el reporte de movimientos');
    } finally {
      setLoading(false);
    }
  };

  const cargarReporteTopProductos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/reportes/top-products?days=${diasTopProductos}&limit=${limiteProductos}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setReporteTopProductos(response.data.data);
        setSuccess('Reporte de productos más movidos cargado exitosamente');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Error cargando top productos:', err);
      setError('Error al cargar el reporte de productos');
    } finally {
      setLoading(false);
    }
  };

  const cargarAlertasStock = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/inventario/stock-alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setAlertasStock(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando alertas de stock:', err);
    }
  };

  const verProductosCategoria = (categoria) => {
    const productos = inventarioCompleto.filter(p => p.categoria === categoria);
    setCategoriaSeleccionada(categoria);
    setProductosPorCategoria(productos);
    setModalCategoria(true);
  };

  // Funciones para gestión de productos
  const abrirModalCrear = () => {
    setModoEdicion(false);
    setProductoSeleccionado(null);
    setFormProducto({
      codigo: '',
      nombre: '',
      descripcion: '',
      stock: 0,
      categoria: '',
      unidad: 'unidad',
      stock_minimo: 0,
      precio: 0
    });
    setModalProducto(true);
  };

  const abrirModalEditar = (producto) => {
    console.log('🔧 Editando producto:', producto);
    setModoEdicion(true);
    setProductoSeleccionado(producto);
    setFormProducto({
      codigo: producto.codigo || '',
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      categoria: producto.categoria || '',
      unidad: producto.unidad || 'unidad',
      stock_minimo: producto.stock_minimo || 0,
      stock: producto.stock || 0,
      precio: producto.precio || 0
    });
    setModalProducto(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormProducto(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const crearProducto = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      console.log('➕ Creando producto:', formProducto);
      
      const response = await axios.post(
        `${API_URL}/inventario/products`,
        formProducto,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setSuccess('Producto creado exitosamente');
        setTimeout(() => setSuccess(null), 3000);
        setModalProducto(false);
        await cargarInventarioCompleto();
        await cargarReporteCategorias();
      }
    } catch (err) {
      console.error('❌ Error creando producto:', err);
      setError(err.response?.data?.message || 'Error al crear el producto');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const editarProducto = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      console.log('✏️ Actualizando producto:', productoSeleccionado.id, formProducto);
      
      const response = await axios.put(
        `${API_URL}/inventario/products/${productoSeleccionado.id}`,
        formProducto,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setSuccess('Producto actualizado exitosamente');
        setTimeout(() => setSuccess(null), 3000);
        setModalProducto(false);
        await cargarInventarioCompleto();
        await cargarReporteCategorias();
      }
    } catch (err) {
      console.error('❌ Error actualizando producto:', err);
      setError(err.response?.data?.message || 'Error al actualizar el producto');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const toggleEstadoProducto = async (producto) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const nuevoEstado = !esActivo(producto.activo);
      
      console.log(`🔄 Cambiando estado de ${producto.nombre} a:`, nuevoEstado ? 'ACTIVO' : 'INACTIVO');
      
      if (!nuevoEstado) {
        // Eliminar (desactivar)
        const response = await axios.delete(
          `${API_URL}/inventario/products/${producto.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          setSuccess(`Producto "${producto.nombre}" desactivado exitosamente`);
        }
      } else {
        // Reactivar producto (actualizar campo activo a true)
        const response = await axios.put(
          `${API_URL}/inventario/products/${producto.id}`,
          { activo: true },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          setSuccess(`Producto "${producto.nombre}" activado exitosamente`);
        }
      }
      
      setTimeout(() => setSuccess(null), 3000);
      await cargarInventarioCompleto();
      await cargarReporteCategorias();
    } catch (err) {
      console.error('❌ Error cambiando estado del producto:', err);
      setError(err.response?.data?.message || 'Error al cambiar el estado del producto');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const descargarReporteExcel = async (tipo) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let url = '';
      let filename = '';

      switch (tipo) {
        case 'inventario':
          url = `${API_URL}/reportes/excel/inventario`;
          filename = `reporte_inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        case 'movimientos':
          url = `${API_URL}/reportes/excel/movimientos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
          filename = `reporte_movimientos_${fechaInicio}_a_${fechaFin}.xlsx`;
          break;
        case 'productos-movidos':
          url = `${API_URL}/reportes/excel/productos-movidos?dias=${diasTopProductos}&limite=${limiteProductos}`;
          filename = `reporte_productos_movidos_${diasTopProductos}dias.xlsx`;
          break;
        case 'completo':
          url = `${API_URL}/reportes/excel/completo?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}&dias=${diasTopProductos}`;
          filename = `reporte_completo_sistema_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        default:
          throw new Error('Tipo de reporte no válido');
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = urlBlob;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess(`Reporte ${tipo} descargado exitosamente`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error descargando reporte Excel:', err);
      setError('Error al descargar el reporte en Excel');
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(valor || 0);
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Función helper para verificar si un valor es "verdadero" en cualquier formato
  const esActivo = (valor) => {
    return valor === true || valor === 't' || valor === 'true' || valor === 'TRUE';
  };

  // Función helper para verificar si un valor es "falso" en cualquier formato
  const esInactivo = (valor) => {
    return valor === false || valor === 'f' || valor === 'false' || valor === 'FALSE';
  };

  // Filtrar inventario completo según los filtros seleccionados
  const inventarioFiltrado = inventarioCompleto.filter(producto => {
    console.log('Producto:', producto.codigo, 'Activo:', producto.activo, 'Stock:', producto.stock, 'Min:', producto.stock_minimo);
    
    // Filtro por stock
    let cumpleFiltroStock = true;
    if (filtroStock === 'bajo') {
      cumpleFiltroStock = Number(producto.stock) <= Number(producto.stock_minimo);
      console.log('Filtro bajo:', cumpleFiltroStock, producto.codigo);
    } else if (filtroStock === 'normal') {
      cumpleFiltroStock = Number(producto.stock) > Number(producto.stock_minimo);
      console.log('Filtro normal:', cumpleFiltroStock, producto.codigo);
    }

    // Filtro por estado activo - manejar múltiples formatos
    let cumpleFiltroActivo = true;
    if (filtroActivo === 'activos') {
      cumpleFiltroActivo = esActivo(producto.activo);
      console.log('Filtro activos:', cumpleFiltroActivo, producto.codigo, producto.activo);
    } else if (filtroActivo === 'inactivos') {
      cumpleFiltroActivo = esInactivo(producto.activo);
      console.log('Filtro inactivos:', cumpleFiltroActivo, producto.codigo, producto.activo);
    }

    const resultado = cumpleFiltroStock && cumpleFiltroActivo;
    if (resultado) {
      console.log('✅ Producto pasa filtro:', producto.codigo);
    }
    
    return resultado;
  });

  // Preparar datos para gráficas
  const datosGraficaCategorias = reporteCategorias.map(cat => ({
    name: cat.categoria,
    productos: parseInt(cat.cantidad_productos),
    stock: parseInt(cat.total_stock),
    valor: parseFloat(cat.valor_total)
  }));

  const datosGraficaMovimientos = reporteMovimientos.reduce((acc, mov) => {
    const fecha = formatearFecha(mov.fecha_dia);
    const existing = acc.find(item => item.fecha === fecha);
    
    if (existing) {
      if (mov.tipo === 'entrada') {
        existing.entradas = parseInt(mov.total_unidades);
      } else {
        existing.salidas = parseInt(mov.total_unidades);
      }
    } else {
      acc.push({
        fecha,
        entradas: mov.tipo === 'entrada' ? parseInt(mov.total_unidades) : 0,
        salidas: mov.tipo === 'salida' ? parseInt(mov.total_unidades) : 0
      });
    }
    
    return acc;
  }, []);

  const datosGraficaTopProductos = reporteTopProductos.map(prod => ({
    name: prod.codigo,
    nombreCompleto: prod.nombre,
    entradas: parseInt(prod.total_entradas),
    salidas: parseInt(prod.total_salidas),
    movimientos: parseInt(prod.total_movimientos)
  }));

  // Datos para gráfica de radar de categorías
  const datosRadarCategorias = reporteCategorias.slice(0, 6).map(cat => ({
    categoria: cat.categoria,
    valor: parseFloat(cat.valor_total) / 1000,
    stock: parseInt(cat.total_stock) / 10,
    productos: parseInt(cat.cantidad_productos) * 10
  }));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }} elevation={2}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => window.history.back()} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <AssessmentIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Sistema de Reportes y Analytics
          </Typography>
          <Tooltip title="Actualizar datos">
            <IconButton color="inherit" onClick={() => {
              cargarReporteCategorias();
              cargarAlertasStock();
              cargarInventarioCompleto();
            }}>
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

        {/* Alertas de Stock */}
        {alertasStock.length > 0 && (
          <Card sx={{ mb: 3, bgcolor: 'warning.light', borderLeft: 4, borderColor: 'warning.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WarningIcon sx={{ mr: 1, color: 'warning.dark' }} />
                <Typography variant="h6" color="warning.dark">
                  Alertas de Stock Bajo ({alertasStock.length})
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {alertasStock.slice(0, 5).map((alerta) => (
                  <Chip
                    key={alerta.id}
                    label={`${alerta.nombre_producto}: ${alerta.stock_actual}/${alerta.stock_minimo}`}
                    color={alerta.tipo_alerta === 'critico' ? 'error' : 'warning'}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                ))}
                {alertasStock.length > 5 && (
                  <Chip label={`+${alertasStock.length - 5} más`} size="small" sx={{ mb: 1 }} />
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Estadísticas Rápidas */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {reporteCategorias.length}
                </Typography>
                <Typography variant="body2">Categorías Activas</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {reporteCategorias.reduce((sum, cat) => sum + parseInt(cat.cantidad_productos), 0)}
                </Typography>
                <Typography variant="body2">Total Productos</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {reporteCategorias.reduce((sum, cat) => sum + parseInt(cat.total_stock), 0)}
                </Typography>
                <Typography variant="body2">Unidades en Stock</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'secondary.main', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {formatearMoneda(reporteCategorias.reduce((sum, cat) => sum + parseFloat(cat.valor_total), 0))}
                </Typography>
                <Typography variant="body2">Valor Total</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Botones de Descarga Rápida */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <ExcelIcon sx={{ mr: 1 }} />
              Descargas Rápidas en Excel
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  startIcon={<DownloadIcon />}
                  onClick={() => descargarReporteExcel('inventario')}
                  disabled={loading}
                >
                  Inventario
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  color="info"
                  startIcon={<DownloadIcon />}
                  onClick={() => descargarReporteExcel('movimientos')}
                  disabled={loading}
                >
                  Movimientos
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  color="warning"
                  startIcon={<DownloadIcon />}
                  onClick={() => descargarReporteExcel('productos-movidos')}
                  disabled={loading}
                >
                  Top Productos
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  startIcon={<DownloadIcon />}
                  onClick={() => descargarReporteExcel('completo')}
                  disabled={loading}
                >
                  Reporte Completo
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabs de Reportes */}
        <Card>
          <Tabs
            value={tabActual}
            onChange={(e, newValue) => setTabActual(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<CategoryIcon />} label="Por Categorías" />
            <Tab icon={<TimelineIcon />} label="Movimientos" />
            <Tab icon={<TrendingUpIcon />} label="Top Productos" />
            <Tab icon={<InventoryIcon />} label="Inventario Completo" />
            <Tab icon={<BarChartIcon />} label="Dashboard" />
          </Tabs>

          <Divider />

          <CardContent>
            {/* Tab 0: Reporte por Categorías */}
            {tabActual === 0 && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">Análisis por Categorías</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={cargarReporteCategorias}
                    disabled={loading}
                  >
                    Actualizar
                  </Button>
                </Box>

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    {/* Gráficas de Categorías */}
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                      <Grid item xs={12} lg={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                              <PieChartIcon sx={{ mr: 1 }} />
                              Distribución por Valor
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={datosGraficaCategorias}
                                  dataKey="valor"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={100}
                                  label={(entry) => `${entry.name}: ${formatearMoneda(entry.valor)}`}
                                >
                                  {datosGraficaCategorias.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <RechartsTooltip formatter={(value) => formatearMoneda(value)} />
                              </PieChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </Grid>

                      <Grid item xs={12} lg={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                              <BarChartIcon sx={{ mr: 1 }} />
                              Stock por Categoría
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={datosGraficaCategorias}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <RechartsTooltip />
                                <Legend />
                                <Bar dataKey="stock" fill="#8884d8" name="Stock Total" />
                                <Bar dataKey="productos" fill="#82ca9d" name="Cantidad Productos" />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </Grid>

                      <Grid item xs={12}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                              <ShowChartIcon sx={{ mr: 1 }} />
                              Análisis Multidimensional
                            </Typography>
                            <ResponsiveContainer width="100%" height={350}>
                              <RadarChart data={datosRadarCategorias}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="categoria" />
                                <PolarRadiusAxis />
                                <Radar name="Valor (k)" dataKey="valor" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                                <Radar name="Stock" dataKey="stock" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                                <Radar name="Productos" dataKey="productos" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
                                <Legend />
                                <RechartsTooltip />
                              </RadarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    {/* Tabla de Categorías */}
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Categoría</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Productos</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Stock Total</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Promedio Stock</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Valor Total</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Acciones</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reporteCategorias.map((cat, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell>
                                <Chip 
                                  label={cat.categoria} 
                                  sx={{ bgcolor: COLORS[idx % COLORS.length], color: 'white' }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Chip label={cat.cantidad_productos} size="small" />
                              </TableCell>
                              <TableCell align="center">{cat.total_stock}</TableCell>
                              <TableCell align="center">{cat.promedio_stock}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
                                {formatearMoneda(cat.valor_total)}
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="Ver productos">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => verProductosCategoria(cat.categoria)}
                                  >
                                    <VisibilityIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </Box>
            )}

            {/* Tab 1: Movimientos por Período */}
            {tabActual === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Movimientos por Período
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Fecha Inicio"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Fecha Fin"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={cargarReporteMovimientos}
                      disabled={loading}
                      sx={{ height: '56px' }}
                    >
                      Generar Reporte
                    </Button>
                  </Grid>
                </Grid>

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : reporteMovimientos.length > 0 ? (
                  <>
                    <Card variant="outlined" sx={{ mb: 3 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Tendencia de Movimientos
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={datosGraficaMovimientos}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="fecha" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            <Line type="monotone" dataKey="entradas" stroke="#82ca9d" name="Entradas" strokeWidth={2} />
                            <Line type="monotone" dataKey="salidas" stroke="#ff8042" name="Salidas" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Movimientos</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Total Unidades</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reporteMovimientos.map((mov, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell>{formatearFecha(mov.fecha_dia)}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={mov.tipo.toUpperCase()} 
                                  color={mov.tipo === 'entrada' ? 'success' : 'error'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">{mov.total_movimientos}</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600 }}>
                                {mov.total_unidades}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : (
                  <Alert severity="info">
                    Selecciona el rango de fechas y haz clic en "Generar Reporte"
                  </Alert>
                )}
              </Box>
            )}

            {/* Tab 2: Top Productos */}
            {tabActual === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Productos Más Movidos
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      select
                      label="Últimos días"
                      value={diasTopProductos}
                      onChange={(e) => setDiasTopProductos(e.target.value)}
                    >
                      <MenuItem value={7}>7 días</MenuItem>
                      <MenuItem value={15}>15 días</MenuItem>
                      <MenuItem value={30}>30 días</MenuItem>
                      <MenuItem value={60}>60 días</MenuItem>
                      <MenuItem value={90}>90 días</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      select
                      label="Límite de productos"
                      value={limiteProductos}
                      onChange={(e) => setLimiteProductos(e.target.value)}
                    >
                      <MenuItem value={5}>Top 5</MenuItem>
                      <MenuItem value={10}>Top 10</MenuItem>
                      <MenuItem value={20}>Top 20</MenuItem>
                      <MenuItem value={50}>Top 50</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={cargarReporteTopProductos}
                      disabled={loading}
                      sx={{ height: '56px' }}
                    >
                      Generar Reporte
                    </Button>
                  </Grid>
                </Grid>

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : reporteTopProductos.length > 0 ? (
                  <>
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                      <Grid item xs={12} lg={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              Comparación Entradas vs Salidas
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={datosGraficaTopProductos}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <RechartsTooltip content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <Paper sx={{ p: 1 }}>
                                        <Typography variant="body2" fontWeight="bold">
                                          {payload[0].payload.nombreCompleto}
                                        </Typography>
                                        <Typography variant="caption" color="success.main">
                                          Entradas: {payload[0].value}
                                        </Typography>
                                        <br />
                                        <Typography variant="caption" color="error.main">
                                          Salidas: {payload[1].value}
                                        </Typography>
                                      </Paper>
                                    );
                                  }
                                  return null;
                                }} />
                                <Legend />
                                <Bar dataKey="entradas" fill="#82ca9d" name="Entradas" />
                                <Bar dataKey="salidas" fill="#ff8042" name="Salidas" />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </Grid>

                      <Grid item xs={12} lg={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              Total de Movimientos
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={datosGraficaTopProductos} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={80} />
                                <RechartsTooltip content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <Paper sx={{ p: 1 }}>
                                        <Typography variant="body2" fontWeight="bold">
                                          {payload[0].payload.nombreCompleto}
                                        </Typography>
                                        <Typography variant="caption">
                                          Movimientos: {payload[0].value}
                                        </Typography>
                                      </Paper>
                                    );
                                  }
                                  return null;
                                }} />
                                <Bar dataKey="movimientos" fill="#8884d8" name="Total Movimientos">
                                  {datosGraficaTopProductos.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Ranking</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Código</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Producto</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Categoría</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Movimientos</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Entradas</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Salidas</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600 }}>Neto</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reporteTopProductos.map((prod, idx) => (
                            <TableRow key={idx} hover>
                              <TableCell>
                                <Avatar sx={{ 
                                  bgcolor: idx < 3 ? 'warning.main' : 'grey.400',
                                  width: 32,
                                  height: 32,
                                  fontSize: '0.875rem'
                                }}>
                                  {idx + 1}
                                </Avatar>
                              </TableCell>
                              <TableCell>{prod.codigo}</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{prod.nombre}</TableCell>
                              <TableCell>
                                <Chip label={prod.categoria} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell align="center">
                                <Badge badgeContent={prod.total_movimientos} color="primary" max={999}>
                                  <BarChartIcon />
                                </Badge>
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'success.main', fontWeight: 600 }}>
                                +{prod.total_entradas}
                              </TableCell>
                              <TableCell align="center" sx={{ color: 'error.main', fontWeight: 600 }}>
                                -{prod.total_salidas}
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={prod.neto}
                                  color={prod.neto >= 0 ? 'success' : 'error'}
                                  size="small"
                                  sx={{ fontWeight: 600 }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : (
                  <Alert severity="info">
                    Selecciona los parámetros y haz clic en "Generar Reporte"
                  </Alert>
                )}
              </Box>
            )}

            {/* Tab 3: Inventario Completo */}
            {tabActual === 3 && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">Inventario Completo</Typography>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<AddIcon />}
                      onClick={abrirModalCrear}
                    >
                      Nuevo Producto
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={cargarInventarioCompleto}
                      disabled={loading}
                    >
                      Actualizar
                    </Button>
                  </Stack>
                </Box>

                {/* Filtros */}
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                      <FilterListIcon sx={{ mr: 1 }} />
                      Filtros
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Estado del Producto</InputLabel>
                          <Select
                            value={filtroActivo}
                            label="Estado del Producto"
                            onChange={(e) => setFiltroActivo(e.target.value)}
                          >
                            <MenuItem value="todos">Todos los productos</MenuItem>
                            <MenuItem value="activos">Solo Activos</MenuItem>
                            <MenuItem value="inactivos">Solo Inactivos</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Nivel de Stock</InputLabel>
                          <Select
                            value={filtroStock}
                            label="Nivel de Stock"
                            onChange={(e) => setFiltroStock(e.target.value)}
                          >
                            <MenuItem value="todos">Todos los niveles</MenuItem>
                            <MenuItem value="bajo">Stock Bajo</MenuItem>
                            <MenuItem value="normal">Stock Normal</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                    
                    {/* Resumen de filtros */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Mostrando {inventarioFiltrado.length} de {inventarioCompleto.length} productos
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                          <TableCell sx={{ fontWeight: 600 }}>Código</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Nombre</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Categoría</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Stock Actual</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Stock Mínimo</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Precio</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Estado Stock</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Estado</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inventarioFiltrado.length > 0 ? (
                          inventarioFiltrado.map((producto) => (
                            <TableRow 
                              key={producto.id} 
                              hover
                              sx={{ 
                                opacity: esActivo(producto.activo) ? 1 : 0.6,
                                bgcolor: esActivo(producto.activo) ? 'inherit' : 'grey.50'
                              }}
                            >
                              <TableCell>{producto.codigo}</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{producto.nombre}</TableCell>
                              <TableCell>
                                <Chip label={producto.categoria} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                {producto.stock}
                              </TableCell>
                              <TableCell align="center">{producto.stock_minimo}</TableCell>
                              <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                                {formatearMoneda(producto.precio)}
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={Number(producto.stock) <= Number(producto.stock_minimo) ? 'BAJO' : 'NORMAL'}
                                  color={Number(producto.stock) <= Number(producto.stock_minimo) ? 'error' : 'success'}
                                  size="small"
                                  icon={Number(producto.stock) <= Number(producto.stock_minimo) ? <WarningIcon /> : <CheckCircleIcon />}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={esActivo(producto.activo) ? 'ACTIVO' : 'INACTIVO'}
                                  color={esActivo(producto.activo) ? 'success' : 'default'}
                                  size="small"
                                  icon={esActivo(producto.activo) ? <CheckCircleIcon /> : <CancelIcon />}
                                  variant={esActivo(producto.activo) ? 'filled' : 'outlined'}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Stack direction="row" spacing={1} justifyContent="center">
                                  <Tooltip title="Editar">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => abrirModalEditar(producto)}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={esActivo(producto.activo) ? 'Desactivar' : 'Activar'}>
                                    <IconButton
                                      size="small"
                                      color={esActivo(producto.activo) ? 'error' : 'success'}
                                      onClick={() => toggleEstadoProducto(producto)}
                                    >
                                      {esActivo(producto.activo) ? <DeleteIcon fontSize="small" /> : <RestoreIcon fontSize="small" />}
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={9} align="center">
                              <Alert severity="info">
                                No se encontraron productos con los filtros seleccionados
                              </Alert>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}

            {/* Tab 4: Dashboard General */}
            {tabActual === 4 && (
              <Box>
                <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                  Dashboard de Analytics
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Resumen General de Inventario
                        </Typography>
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={datosGraficaCategorias}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <RechartsTooltip />
                            <Legend />
                            <Bar yAxisId="left" dataKey="productos" fill="#8884d8" name="Cantidad Productos" />
                            <Bar yAxisId="left" dataKey="stock" fill="#82ca9d" name="Stock Total" />
                            <Bar yAxisId="right" dataKey="valor" fill="#ffc658" name="Valor (MXN)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Distribución de Stock por Categoría
                        </Typography>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={datosGraficaCategorias}
                              dataKey="stock"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label
                            >
                              {datosGraficaCategorias.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Top 5 Categorías por Valor
                        </Typography>
                        <List>
                          {datosGraficaCategorias
                            .sort((a, b) => b.valor - a.valor)
                            .slice(0, 5)
                            .map((cat, idx) => (
                              <ListItem key={idx}>
                                <Avatar sx={{ 
                                  bgcolor: COLORS[idx % COLORS.length],
                                  mr: 2
                                }}>
                                  {idx + 1}
                                </Avatar>
                                <ListItemText
                                  primary={cat.name}
                                  secondary={
                                    <>
                                      <Typography component="span" variant="body2" color="text.primary">
                                        {formatearMoneda(cat.valor)}
                                      </Typography>
                                      {` — ${cat.productos} productos, ${cat.stock} unidades`}
                                    </>
                                  }
                                />
                              </ListItem>
                            ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>

                  {alertasStock.length > 0 && (
                    <Grid item xs={12}>
                      <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom color="warning.main">
                            Estado de Alertas de Stock
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                              <Card sx={{ bgcolor: 'error.light' }}>
                                <CardContent>
                                  <Typography variant="h3" color="error.dark">
                                    {alertasStock.filter(a => a.tipo_alerta === 'critico').length}
                                  </Typography>
                                  <Typography variant="body2">Alertas Críticas</Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Card sx={{ bgcolor: 'warning.light' }}>
                                <CardContent>
                                  <Typography variant="h3" color="warning.dark">
                                    {alertasStock.filter(a => a.tipo_alerta === 'alerta').length}
                                  </Typography>
                                  <Typography variant="body2">Alertas Preventivas</Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Card sx={{ bgcolor: 'info.light' }}>
                                <CardContent>
                                  <Typography variant="h3" color="info.dark">
                                    {alertasStock.length}
                                  </Typography>
                                  <Typography variant="body2">Total Alertas</Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>

      {/* Modal para ver productos por categoría */}
      <Dialog
        open={modalCategoria}
        onClose={() => setModalCategoria(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Productos en {categoriaSeleccionada}
        </DialogTitle>
        <DialogContent>
          {productosPorCategoria.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Nombre</TableCell>
                    <TableCell align="center">Stock</TableCell>
                    <TableCell align="center">Mínimo</TableCell>
                    <TableCell align="right">Precio</TableCell>
                    <TableCell align="center">Estado Stock</TableCell>
                    <TableCell align="center">Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productosPorCategoria.map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell>{prod.codigo}</TableCell>
                      <TableCell>{prod.nombre}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>{prod.stock}</TableCell>
                      <TableCell align="center">{prod.stock_minimo}</TableCell>
                      <TableCell align="right">{formatearMoneda(prod.precio)}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={Number(prod.stock) <= Number(prod.stock_minimo) ? 'Bajo' : 'Normal'}
                          color={Number(prod.stock) <= Number(prod.stock_minimo) ? 'error' : 'success'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={esActivo(prod.activo) ? 'Activo' : 'Inactivo'}
                          color={esActivo(prod.activo) ? 'success' : 'default'}
                          size="small"
                          variant={esActivo(prod.activo) ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No hay productos en esta categoría</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalCategoria(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal para crear/editar producto */}
      <Dialog
        open={modalProducto}
        onClose={() => setModalProducto(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {modoEdicion ? 'Editar Producto' : 'Crear Nuevo Producto'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Código"
                  name="codigo"
                  value={formProducto.codigo}
                  onChange={handleInputChange}
                  required
                  disabled={modoEdicion}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Categoría"
                  name="categoria"
                  value={formProducto.categoria}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre"
                  name="nombre"
                  value={formProducto.nombre}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descripción"
                  name="descripcion"
                  value={formProducto.descripcion}
                  onChange={handleInputChange}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  select
                  label="Unidad"
                  name="unidad"
                  value={formProducto.unidad}
                  onChange={handleInputChange}
                >
                  <MenuItem value="unidad">Unidad</MenuItem>
                  <MenuItem value="kg">Kilogramo</MenuItem>
                  <MenuItem value="g">Gramo</MenuItem>
                  <MenuItem value="l">Litro</MenuItem>
                  <MenuItem value="ml">Mililitro</MenuItem>
                  <MenuItem value="caja">Caja</MenuItem>
                  <MenuItem value="paquete">Paquete</MenuItem>
                  <MenuItem value="par">Par</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Stock Inicial"
                  name="stock"
                  type="number"
                  value={formProducto.stock}
                  onChange={handleInputChange}
                  required
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Stock Mínimo"
                  name="stock_minimo"
                  type="number"
                  value={formProducto.stock_minimo}
                  onChange={handleInputChange}
                  required
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Precio"
                  name="precio"
                  type="number"
                  value={formProducto.precio}
                  onChange={handleInputChange}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalProducto(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={modoEdicion ? editarProducto : crearProducto}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : modoEdicion ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reportes;