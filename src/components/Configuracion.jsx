import React, { useState, useEffect } from 'react'
import { Save, Plus, Edit, Trash2, X, Upload, Image } from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '../utils/api'

function Configuracion() {
  const [configuracion, setConfiguracion] = useState({
    nombre_novia: '',
    nombre_novio: '',
    fecha_boda: '',
    hora_boda: '',
    lugar_boda: '',
    imagen_portada: ''
  })
  
  const [hotel, setHotel] = useState({
    nombre: '',
    direccion: '',
    servicios_incluidos: []
  })
  
  const [habitaciones, setHabitaciones] = useState([])
  const [showHabitacionModal, setShowHabitacionModal] = useState(false)
  const [selectedHabitacion, setSelectedHabitacion] = useState(null)
  const [habitacionForm, setHabitacionForm] = useState({
    nombre: '',
    precio: '',
    capacidad: '',
    cupos_disponibles: ''
  })
  
  const [nuevoServicio, setNuevoServicio] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    fetchConfiguracion()
    fetchHotel()
    fetchHabitaciones()
  }, [])

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('imagen', file)

    try {
      setUploadingImage(true)
      const data = await apiUpload('/upload-portada', formData)
      setConfiguracion(prev => ({
        ...prev,
        imagen_portada: data.imagePath
      }))
      alert('Imagen subida exitosamente')
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Error subiendo imagen')
    } finally {
      setUploadingImage(false)
    }
  }

  const fetchConfiguracion = async () => {
    try {
      const data = await apiGet('/configuracion')
      if (data) {
        setConfiguracion(data)
      }
    } catch (error) {
      console.error('Error fetching configuracion:', error)
    }
  }

  const fetchHotel = async () => {
    try {
      const data = await apiGet('/hotel')
      if (data) {
        // Asegurar que servicios_incluidos sea un array
        const servicios = data.servicios_incluidos
        let serviciosArray = []
        
        if (typeof servicios === 'string') {
          try {
            serviciosArray = JSON.parse(servicios)
          } catch {
            serviciosArray = servicios ? servicios.split(',').map(s => s.trim()).filter(s => s) : []
          }
        } else if (Array.isArray(servicios)) {
          serviciosArray = servicios
        }
        
        setHotel({
          ...data,
          servicios_incluidos: serviciosArray
        })
      }
    } catch (error) {
      console.error('Error fetching hotel:', error)
    }
  }

  const fetchHabitaciones = async () => {
    try {
      const data = await apiGet('/habitaciones')
      setHabitaciones(data)
    } catch (error) {
      console.error('Error fetching habitaciones:', error)
    }
  }

  const handleConfiguracionSubmit = async (e) => {
    e.preventDefault()
    try {
      await apiPost('/configuracion', configuracion)
      alert('Configuración guardada exitosamente')
    } catch (error) {
      console.error('Error saving configuracion:', error)
      alert('Error guardando configuración')
    }
  }

  const handleHotelSubmit = async (e) => {
    e.preventDefault()
    try {
      // Convertir servicios_incluidos a JSON string para enviar al backend
      const hotelData = {
        ...hotel,
        servicios_incluidos: JSON.stringify(hotel.servicios_incluidos)
      }
      await apiPost('/hotel', hotelData)
      alert('Información del hotel guardada exitosamente')
    } catch (error) {
      console.error('Error saving hotel:', error)
      alert('Error guardando información del hotel')
    }
  }

  const handleHabitacionSubmit = async (e) => {
    e.preventDefault()
    try {
      if (selectedHabitacion) {
        await apiPut(`/habitaciones/${selectedHabitacion.id}`, habitacionForm)
      } else {
        await apiPost('/habitaciones', habitacionForm)
      }
      
      setHabitacionForm({ nombre: '', precio: '', capacidad: '', cupos_disponibles: '' })
      setShowHabitacionModal(false)
      setSelectedHabitacion(null)
      fetchHabitaciones()
      alert('Habitación guardada exitosamente')
    } catch (error) {
      console.error('Error saving habitacion:', error)
      alert('Error guardando habitación')
    }
  }

  const handleDeleteHabitacion = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta habitación?')) {
      try {
        await apiDelete(`/habitaciones/${id}`)
        fetchHabitaciones()
        alert('Habitación eliminada exitosamente')
      } catch (error) {
        console.error('Error deleting habitacion:', error)
        alert('Error eliminando habitación')
      }
    }
  }

  const openEditHabitacion = (habitacion) => {
    setSelectedHabitacion(habitacion)
    setHabitacionForm({
      nombre: habitacion.nombre,
      precio: habitacion.precio.toString(),
      capacidad: habitacion.capacidad.toString(),
      cupos_disponibles: habitacion.cupos_disponibles.toString()
    })
    setShowHabitacionModal(true)
  }

  const agregarServicio = () => {
    if (nuevoServicio.trim()) {
      setHotel({
        ...hotel,
        servicios_incluidos: [...(hotel.servicios_incluidos || []), nuevoServicio.trim()]
      })
      setNuevoServicio('')
    }
  }

  const eliminarServicio = (index) => {
    setHotel({
      ...hotel,
      servicios_incluidos: (hotel.servicios_incluidos || []).filter((_, i) => i !== index)
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>

      {/* Configuración de la Boda */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Datos de la Boda</h2>
        <form onSubmit={handleConfiguracionSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Novia
              </label>
              <input
                type="text"
                required
                className="input-field"
                value={configuracion.nombre_novia}
                onChange={(e) => setConfiguracion({ ...configuracion, nombre_novia: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Novio
              </label>
              <input
                type="text"
                required
                className="input-field"
                value={configuracion.nombre_novio}
                onChange={(e) => setConfiguracion({ ...configuracion, nombre_novio: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de la Boda
              </label>
              <input
                type="date"
                required
                className="input-field"
                value={configuracion.fecha_boda}
                onChange={(e) => setConfiguracion({ ...configuracion, fecha_boda: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora de la Boda
              </label>
              <input
                type="time"
                required
                className="input-field"
                value={configuracion.hora_boda}
                onChange={(e) => setConfiguracion({ ...configuracion, hora_boda: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lugar de la Boda
            </label>
            <input
              type="text"
              required
              className="input-field"
              value={configuracion.lugar_boda}
              onChange={(e) => setConfiguracion({ ...configuracion, lugar_boda: e.target.value })}
            />
          </div>
          
          <button type="submit" className="btn-primary flex items-center space-x-2">
            <Save size={20} />
            <span>Guardar Configuración</span>
          </button>
        </form>
      </div>

      {/* Configuración del Hotel */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Datos del Hotel</h2>
        <form onSubmit={handleHotelSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Hotel
            </label>
            <input
              type="text"
              required
              className="input-field"
              value={hotel.nombre}
              onChange={(e) => setHotel({ ...hotel, nombre: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <input
              type="text"
              required
              className="input-field"
              value={hotel.direccion}
              onChange={(e) => setHotel({ ...hotel, direccion: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Servicios Incluidos
            </label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="Agregar servicio..."
                  value={nuevoServicio}
                  onChange={(e) => setNuevoServicio(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), agregarServicio())}
                />
                <button
                  type="button"
                  onClick={agregarServicio}
                  className="btn-secondary"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              {(hotel.servicios_incluidos || []).length > 0 && (
                <div className="space-y-1">
                  {(hotel.servicios_incluidos || []).map((servicio, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span>{servicio}</span>
                      <button
                        type="button"
                        onClick={() => eliminarServicio(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <button type="submit" className="btn-primary flex items-center space-x-2">
            <Save size={20} />
            <span>Guardar Hotel</span>
          </button>
        </form>
      </div>

      {/* Habitaciones */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Habitaciones</h2>
          <button
            onClick={() => setShowHabitacionModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>Agregar Habitación</span>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cupos Disponibles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {habitaciones.map((habitacion) => (
                <tr key={habitacion.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {habitacion.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(habitacion.precio)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {habitacion.capacidad}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {habitacion.cupos_disponibles}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditHabitacion(habitacion)}
                      className="text-gold-600 hover:text-gold-900"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteHabitacion(habitacion.id)}
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

      {/* Habitación Modal */}
      {showHabitacionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {selectedHabitacion ? 'Editar Habitación' : 'Agregar Habitación'}
              </h3>
              <button
                onClick={() => {
                  setShowHabitacionModal(false)
                  setSelectedHabitacion(null)
                  setHabitacionForm({
                    nombre: '',
                    precio: '',
                    capacidad: '',
                    cupos_disponibles: ''
                  })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleHabitacionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={habitacionForm.nombre}
                  onChange={(e) => setHabitacionForm({ ...habitacionForm, nombre: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="input-field"
                  value={habitacionForm.precio}
                  onChange={(e) => setHabitacionForm({ ...habitacionForm, precio: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacidad
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  className="input-field"
                  value={habitacionForm.capacidad}
                  onChange={(e) => setHabitacionForm({ ...habitacionForm, capacidad: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cupos Disponibles
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  className="input-field"
                  value={habitacionForm.cupos_disponibles}
                  onChange={(e) => setHabitacionForm({ ...habitacionForm, cupos_disponibles: e.target.value })}
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {selectedHabitacion ? 'Actualizar' : 'Agregar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowHabitacionModal(false)
                    setSelectedHabitacion(null)
                    setHabitacionForm({
                      nombre: '',
                      precio: '',
                      capacidad: '',
                      cupos_disponibles: ''
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

export default Configuracion