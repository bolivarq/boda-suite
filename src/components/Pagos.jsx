import React, { useState, useEffect } from 'react'
import { Plus, Search, DollarSign, X, Download } from 'lucide-react'
import { apiGet, apiPost, API_BASE_URL } from '../utils/api'

function Pagos() {
  const [pagos, setPagos] = useState([])
  const [invitados, setInvitados] = useState([])
  const [filtros, setFiltros] = useState({
    busqueda: '',
    metodo: '',
    fechaInicio: '',
    fechaFin: ''
  })
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    invitado_id: '',
    monto: '',
    metodo_pago: '',
    fecha_pago: new Date().toISOString().split('T')[0]
  })

  const metodosPago = ['Efectivo', 'Transferencia', 'Tarjeta', 'Zelle', 'Paypal']

  useEffect(() => {
    fetchPagos()
    fetchInvitados()
  }, [])

  const fetchPagos = async () => {
    try {
      const data = await apiGet('/pagos')
      setPagos(data)
    } catch (error) {
      console.error('Error fetching pagos:', error)
    }
  }

  const fetchInvitados = async () => {
    try {
      const data = await apiGet('/invitados')
      setInvitados(data)
    } catch (error) {
      console.error('Error fetching invitados:', error)
    }
  }

  const handleDownloadRecibo = async (pago) => {
    try {
      // Generar nombre del archivo basado en el pago
      const invitadoNombre = pago.invitado_nombre.replace(/\s+/g, '_')
      const fechaPago = new Date(pago.fecha_pago).toISOString().split('T')[0]
      const fileName = `recibo_${invitadoNombre}_${fechaPago}_${pago.id}.pdf`
      
      // Intentar descargar el recibo existente
      const response = await fetch(`/api/recibos/${fileName}`)
      
      if (response.ok) {
        // Si el recibo existe, descargarlo
        const link = document.createElement('a')
        link.href = `${API_BASE_URL}/recibos/${fileName}`
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // Si no existe, regenerar el recibo
        const regenerateResponse = await fetch(`${API_BASE_URL}/pagos/regenerar-recibo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pagoId: pago.id }),
        })
        
        if (regenerateResponse.ok) {
          const result = await regenerateResponse.json()
          
          // Descargar el recibo regenerado
          const link = document.createElement('a')
          link.href = `${API_BASE_URL}/recibos/${result.recibo.fileName}`
          link.download = result.recibo.fileName
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        } else {
          alert('Error al generar el recibo')
        }
      }
    } catch (error) {
      console.error('Error downloading recibo:', error)
      alert('Error al descargar el recibo')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const result = await apiPost('/pagos', formData)
      
      setShowModal(false)
      setFormData({
        invitado_id: '',
        monto: '',
        metodo_pago: 'Efectivo',
        fecha_pago: new Date().toISOString().split('T')[0]
      })
      fetchPagos()
      
      // Mostrar notificación de éxito con opción de descargar recibo
      if (result.recibo) {
        const shouldDownload = window.confirm(
          `Pago registrado exitosamente. ¿Deseas descargar el recibo PDF?`
        )
        
        if (shouldDownload) {
          // Descargar el recibo
          const link = document.createElement('a')
          link.href = `${API_BASE_URL}/recibos/${result.recibo.fileName}`
          link.download = result.recibo.fileName
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al registrar el pago: ' + error.message)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES')
  }

  const getMetodoColor = (metodo) => {
    const colors = {
      'Efectivo': 'bg-green-100 text-green-800',
      'Transferencia': 'bg-blue-100 text-blue-800',
      'Tarjeta': 'bg-purple-100 text-purple-800',
      'Zelle': 'bg-yellow-100 text-yellow-800',
      'Paypal': 'bg-indigo-100 text-indigo-800'
    }
    return colors[metodo] || 'bg-gray-100 text-gray-800'
  }

  const pagosFiltrados = pagos.filter(pago => {
    const matchBusqueda = pago.invitado_nombre.toLowerCase().includes(filtros.busqueda.toLowerCase())
    const matchMetodo = !filtros.metodo || pago.metodo_pago === filtros.metodo
    const matchFechaInicio = !filtros.fechaInicio || new Date(pago.fecha_pago) >= new Date(filtros.fechaInicio)
    const matchFechaFin = !filtros.fechaFin || new Date(pago.fecha_pago) <= new Date(filtros.fechaFin)
    return matchBusqueda && matchMetodo && matchFechaInicio && matchFechaFin
  })

  const totalPagos = pagosFiltrados.reduce((sum, pago) => sum + parseFloat(pago.monto), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Pagos</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Registrar Pago</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-gold-100">
              <DollarSign className="h-6 w-6 text-gold-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Mostrado</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPagos)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Pagos Filtrados</p>
            <p className="text-lg font-semibold">{pagosFiltrados.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por invitado..."
              className="input-field pl-10"
              value={filtros.busqueda}
              onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            />
          </div>
          
          <select
            className="select-field"
            value={filtros.metodo}
            onChange={(e) => setFiltros({ ...filtros, metodo: e.target.value })}
          >
            <option value="">Todos los métodos</option>
            {metodosPago.map(metodo => (
              <option key={metodo} value={metodo}>{metodo}</option>
            ))}
          </select>
          
          <input
            type="date"
            className="input-field"
            placeholder="Fecha inicio"
            value={filtros.fechaInicio}
            onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
          />
          
          <input
            type="date"
            className="input-field"
            placeholder="Fecha fin"
            value={filtros.fechaFin}
            onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
          />
        </div>
      </div>

      {/* Pagos List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invitado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Método
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo Pendiente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recibo
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagosFiltrados.map((pago) => (
                <tr key={pago.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {pago.invitado_nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {formatCurrency(pago.monto)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMetodoColor(pago.metodo_pago)}`}>
                      {pago.metodo_pago}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(pago.fecha_pago)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(pago.saldo_pendiente)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => handleDownloadRecibo(pago)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-gold-700 bg-gold-100 hover:bg-gold-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold-500"
                      title="Descargar recibo"
                    >
                      <Download size={16} className="mr-1" />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {pagosFiltrados.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No se encontraron pagos</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Registrar Pago</h3>
              <button
                onClick={() => {
                  setShowModal(false)
                  setFormData({
                    invitado_id: '',
                    monto: '',
                    metodo_pago: '',
                    fecha_pago: new Date().toISOString().split('T')[0]
                  })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invitado
                </label>
                <select
                  required
                  className="select-field"
                  value={formData.invitado_id}
                  onChange={(e) => setFormData({ ...formData, invitado_id: e.target.value })}
                >
                  <option value="">Seleccionar invitado</option>
                  {invitados.map(invitado => (
                    <option key={invitado.id} value={invitado.id}>
                      {invitado.nombre} - Pendiente: {formatCurrency(invitado.saldo_pendiente)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="input-field"
                  value={formData.monto}
                  onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  required
                  className="select-field"
                  value={formData.metodo_pago}
                  onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })}
                >
                  <option value="">Seleccionar método</option>
                  {metodosPago.map(metodo => (
                    <option key={metodo} value={metodo}>{metodo}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Pago
                </label>
                <input
                  type="date"
                  required
                  className="input-field"
                  value={formData.fecha_pago}
                  onChange={(e) => setFormData({ ...formData, fecha_pago: e.target.value })}
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Registrar Pago
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setFormData({
                      invitado_id: '',
                      monto: '',
                      metodo_pago: '',
                      fecha_pago: new Date().toISOString().split('T')[0]
                    })
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
    </div>
  )
}

export default Pagos