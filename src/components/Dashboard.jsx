import React, { useState, useEffect } from 'react'
import { Users, Hotel, DollarSign, AlertCircle, Plus, CreditCard, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiGet } from '../utils/api'

function Dashboard() {
  const [stats, setStats] = useState({
    totalInvitados: 0,
    ocupacionHotel: 0,
    totalRecaudado: 0,
    totalPendiente: 0,
    invitadosPagados: 0,
    invitadosPendientes: 0,
    invitadosParciales: 0
  })

  const [configuracion, setConfiguracion] = useState(null)

  useEffect(() => {
    fetchStats()
    fetchConfiguracion()
  }, [])

  const fetchStats = async () => {
    try {
      const data = await apiGet('/api/dashboard/stats')
      if (data) {
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchConfiguracion = async () => {
    try {
      const data = await apiGet('/api/configuracion')
      if (data && Object.keys(data).length > 0) {
        setConfiguracion(data)
      }
    } catch (error) {
      console.error('Error fetching configuracion:', error)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'No configurado'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header con imagen de portada */}
      <div className="text-center">
        {configuracion && configuracion.imagen_portada && (
          <div className="mb-6">
            <img 
              src={`http://localhost:3002${configuracion.imagen_portada}`}
              alt="Portada de la boda"
              className="w-full max-w-2xl mx-auto h-64 object-cover rounded-lg shadow-lg"
            />
          </div>
        )}
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        {configuracion && (
          <div className="text-lg text-gray-600">
            <p className="font-medium text-gold-600">
              {configuracion.nombre_novia} & {configuracion.nombre_novio}
            </p>
            <p className="text-sm">
              {formatDate(configuracion.fecha_boda)} - {configuracion.lugar_boda}
            </p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Invitados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalInvitados}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <Hotel className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ocupación Hotel</p>
              <p className="text-2xl font-bold text-gray-900">{stats.ocupacionHotel}%</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gold-100">
              <DollarSign className="h-6 w-6 text-gold-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Recaudado</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRecaudado)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Pendiente</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalPendiente)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Status Overview */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Pagos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{stats.invitadosPagados}</p>
            <p className="text-sm text-green-700">Pagados</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{stats.invitadosParciales}</p>
            <p className="text-sm text-yellow-700">Parciales</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{stats.invitadosPendientes}</p>
            <p className="text-sm text-red-700">Pendientes</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/invitados"
            className="flex items-center justify-center space-x-2 btn-primary"
          >
            <Plus size={20} />
            <span>Agregar Invitado</span>
          </Link>
          
          <Link
            to="/pagos"
            className="flex items-center justify-center space-x-2 btn-primary"
          >
            <CreditCard size={20} />
            <span>Registrar Pago</span>
          </Link>
          
          <Link
            to="/configuracion"
            className="flex items-center justify-center space-x-2 btn-secondary"
          >
            <Settings size={20} />
            <span>Editar Configuración</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Dashboard