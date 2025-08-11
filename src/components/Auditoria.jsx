import React, { useState, useEffect } from 'react'
import { Clock, User, Edit, Plus, Trash2, Search, Filter, Calendar } from 'lucide-react'
import { apiGet } from '../utils/api'

function Auditoria() {
  const [auditData, setAuditData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    usuario: '',
    tabla: '',
    accion: '',
    fechaDesde: '',
    fechaHasta: '',
    busqueda: ''
  })

  useEffect(() => {
    fetchAuditData()
  }, [])

  const fetchAuditData = async () => {
    try {
      setLoading(true)
      const data = await apiGet('/auditoria')
      setAuditData(data || [])
    } catch (error) {
      console.error('Error fetching audit data:', error)
      setAuditData([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATE':
        return <Plus size={16} className="text-green-600" />
      case 'UPDATE':
        return <Edit size={16} className="text-blue-600" />
      case 'DELETE':
        return <Trash2 size={16} className="text-red-600" />
      default:
        return <Clock size={16} className="text-gray-600" />
    }
  }

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800'
      case 'DELETE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTableDisplayName = (tableName) => {
    const tableNames = {
      'configuracion_boda': 'Configuración de Boda',
      'hotel': 'Hotel',
      'habitaciones': 'Habitaciones',
      'invitados': 'Invitados',
      'pagos': 'Pagos'
    }
    return tableNames[tableName] || tableName
  }

  const auditDataFiltrada = auditData.filter(item => {
    const matchUsuario = !filtros.usuario || 
      item.creado_por_email?.toLowerCase().includes(filtros.usuario.toLowerCase()) ||
      item.modificado_por_email?.toLowerCase().includes(filtros.usuario.toLowerCase())
    
    const matchTabla = !filtros.tabla || item.tabla === filtros.tabla
    
    const matchBusqueda = !filtros.busqueda || 
      item.descripcion?.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
      item.creado_por_email?.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
      item.modificado_por_email?.toLowerCase().includes(filtros.busqueda.toLowerCase())

    const matchFechaDesde = !filtros.fechaDesde || 
      new Date(item.fecha_modificacion || item.fecha_creacion) >= new Date(filtros.fechaDesde)
    
    const matchFechaHasta = !filtros.fechaHasta || 
      new Date(item.fecha_modificacion || item.fecha_creacion) <= new Date(filtros.fechaHasta + 'T23:59:59')

    return matchUsuario && matchTabla && matchBusqueda && matchFechaDesde && matchFechaHasta
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Auditoría del Sistema</h1>
          <p className="text-gray-600 mt-1">Registro de todas las intervenciones y cambios realizados por los usuarios</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Búsqueda general */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por usuario o descripción..."
              className="input-field pl-10"
              value={filtros.busqueda}
              onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            />
          </div>

          {/* Filtro por usuario */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Filtrar por usuario..."
              className="input-field pl-10"
              value={filtros.usuario}
              onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })}
            />
          </div>

          {/* Filtro por tabla */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              className="select-field pl-10"
              value={filtros.tabla}
              onChange={(e) => setFiltros({ ...filtros, tabla: e.target.value })}
            >
              <option value="">Todas las secciones</option>
              <option value="configuracion_boda">Configuración de Boda</option>
              <option value="hotel">Hotel</option>
              <option value="habitaciones">Habitaciones</option>
              <option value="invitados">Invitados</option>
              <option value="pagos">Pagos</option>
            </select>
          </div>

          {/* Fecha desde */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="date"
              className="input-field pl-10"
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
            />
          </div>

          {/* Fecha hasta */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="date"
              className="input-field pl-10"
              value={filtros.fechaHasta}
              onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
            />
          </div>

          {/* Botón limpiar filtros */}
          <button
            onClick={() => setFiltros({
              usuario: '',
              tabla: '',
              accion: '',
              fechaDesde: '',
              fechaHasta: '',
              busqueda: ''
            })}
            className="btn-secondary"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">{auditDataFiltrada.length}</div>
          <div className="text-sm text-gray-600">Registros Encontrados</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">
            {auditDataFiltrada.filter(item => item.accion === 'CREATE').length}
          </div>
          <div className="text-sm text-gray-600">Creaciones</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">
            {auditDataFiltrada.filter(item => item.accion === 'UPDATE').length}
          </div>
          <div className="text-sm text-gray-600">Modificaciones</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-red-600">
            {auditDataFiltrada.filter(item => item.accion === 'DELETE').length}
          </div>
          <div className="text-sm text-gray-600">Eliminaciones</div>
        </div>
      </div>

      {/* Lista de auditoría */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Historial de Cambios</h3>
        
        {auditDataFiltrada.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No se encontraron registros de auditoría</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {auditDataFiltrada.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getActionIcon(item.accion)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(item.accion)}`}>
                          {item.accion || 'MODIFICACIÓN'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {getTableDisplayName(item.tabla)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {item.descripcion || `Registro ${item.accion?.toLowerCase() || 'modificado'} en ${getTableDisplayName(item.tabla)}`}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <User size={12} />
                          <span>{item.modificado_por_email || item.creado_por_email}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock size={12} />
                          <span>{formatDate(item.fecha_modificacion || item.fecha_creacion)}</span>
                        </div>
                        {item.registro_id && (
                          <span>ID: {item.registro_id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Auditoria