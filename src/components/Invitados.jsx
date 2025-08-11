import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Eye, Edit, Trash2, X } from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api'

function Invitados() {
  const [invitados, setInvitados] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [filtros, setFiltros] = useState({
    busqueda: '',
    estadoPago: '',
    habitacion: ''
  })
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedInvitado, setSelectedInvitado] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    contacto: '',
    habitacion_id: ''
  })

  useEffect(() => {
    fetchInvitados()
    fetchHabitaciones()
  }, [])

  const fetchInvitados = async () => {
    try {
      const data = await apiGet('/api/invitados')
      setInvitados(data)
    } catch (error) {
      console.error('Error fetching invitados:', error)
    }
  }

  const fetchHabitaciones = async () => {
    try {
      const data = await apiGet('/api/habitaciones')
      setHabitaciones(data)
    } catch (error) {
      console.error('Error fetching habitaciones:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (selectedInvitado) {
        await apiPut(`/api/invitados/${selectedInvitado.id}`, formData)
      } else {
        await apiPost('/api/invitados', formData)
      }

      fetchInvitados()
      setShowModal(false)
      setSelectedInvitado(null)
      setFormData({ nombre: '', contacto: '', habitacion_id: '' })
    } catch (error) {
      console.error('Error saving invitado:', error)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este invitado?')) {
      try {
        await apiDelete(`/api/invitados/${id}`)
        fetchInvitados()
      } catch (error) {
        console.error('Error deleting invitado:', error)
      }
    }
  }

  const openEditModal = (invitado) => {
    setSelectedInvitado(invitado)
    setFormData({
      nombre: invitado.nombre,
      contacto: invitado.contacto,
      habitacion_id: invitado.habitacion_id
    })
    setShowModal(true)
  }

  const openDetailModal = async (invitado) => {
    try {
      const pagos = await apiGet(`/api/invitados/${invitado.id}/pagos`)
      setSelectedInvitado({ ...invitado, pagos })
      setShowDetailModal(true)
    } catch (error) {
      console.error('Error fetching pagos:', error)
    }
  }

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'Pagado': return 'bg-green-100 text-green-800'
      case 'Parcial': return 'bg-yellow-100 text-yellow-800'
      case 'Pendiente': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const invitadosFiltrados = invitados.filter(invitado => {
    const matchBusqueda = invitado.nombre.toLowerCase().includes(filtros.busqueda.toLowerCase())
    const matchEstado = !filtros.estadoPago || invitado.estado_pago === filtros.estadoPago
    const matchHabitacion = !filtros.habitacion || invitado.habitacion_id.toString() === filtros.habitacion
    return matchBusqueda && matchEstado && matchHabitacion
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Invitados</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Agregar Invitado</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              className="input-field pl-10"
              value={filtros.busqueda}
              onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            />
          </div>
          
          <select
            className="select-field"
            value={filtros.estadoPago}
            onChange={(e) => setFiltros({ ...filtros, estadoPago: e.target.value })}
          >
            <option value="">Todos los estados</option>
            <option value="Pagado">Pagado</option>
            <option value="Parcial">Parcial</option>
            <option value="Pendiente">Pendiente</option>
          </select>
          
          <select
            className="select-field"
            value={filtros.habitacion}
            onChange={(e) => setFiltros({ ...filtros, habitacion: e.target.value })}
          >
            <option value="">Todas las habitaciones</option>
            {habitaciones.map(habitacion => (
              <option key={habitacion.id} value={habitacion.id}>
                {habitacion.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Invitados List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Habitación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo Pendiente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invitadosFiltrados.map((invitado) => (
                <tr key={invitado.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invitado.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {invitado.contacto}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {invitado.habitacion_nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(invitado.estado_pago)}`}>
                      {invitado.estado_pago}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(invitado.saldo_pendiente)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openDetailModal(invitado)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => openEditModal(invitado)}
                      className="text-gold-600 hover:text-gold-900"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(invitado.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {selectedInvitado ? 'Editar Invitado' : 'Agregar Invitado'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false)
                  setSelectedInvitado(null)
                  setFormData({ nombre: '', contacto: '', habitacion_id: '' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contacto
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.contacto}
                  onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Habitación
                </label>
                <select
                  required
                  className="select-field"
                  value={formData.habitacion_id}
                  onChange={(e) => setFormData({ ...formData, habitacion_id: e.target.value })}
                >
                  <option value="">Seleccionar habitación</option>
                  {habitaciones.map(habitacion => (
                    <option key={habitacion.id} value={habitacion.id}>
                      {habitacion.nombre} - {formatCurrency(habitacion.precio)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {selectedInvitado ? 'Actualizar' : 'Agregar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setSelectedInvitado(null)
                    setFormData({ nombre: '', contacto: '', habitacion_id: '' })
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedInvitado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Detalle del Invitado</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Nombre</p>
                  <p className="text-lg">{selectedInvitado.nombre}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Contacto</p>
                  <p className="text-lg">{selectedInvitado.contacto}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Habitación</p>
                  <p className="text-lg">{selectedInvitado.habitacion_nombre}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Estado</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(selectedInvitado.estado_pago)}`}>
                    {selectedInvitado.estado_pago}
                  </span>
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-semibold mb-2">Historial de Pagos</h4>
                {selectedInvitado.pagos && selectedInvitado.pagos.length > 0 ? (
                  <div className="space-y-2">
                    {selectedInvitado.pagos.map((pago, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{formatCurrency(pago.monto)}</p>
                          <p className="text-sm text-gray-600">{pago.metodo_pago}</p>
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(pago.fecha_pago).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No hay pagos registrados</p>
                )}
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Saldo Pendiente:</span>
                  <span className="text-lg font-bold text-red-600">
                    {formatCurrency(selectedInvitado.saldo_pendiente)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Invitados