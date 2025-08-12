// Base URL del servidor backend
export const API_BASE_URL = import.meta.env.PROD 
  ? '/api' 
  : 'http://localhost:3003/api'

// Utilidad para hacer peticiones API con autenticación automática
export const apiRequest = async (url, options = {}) => {
  const token = localStorage.getItem('token')
  
  // Construir URL completa si es una ruta relativa
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  }

  try {
    const response = await fetch(fullUrl, finalOptions)
    
    // Si el token es inválido, redirigir al login
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
      return
    }

    return response
  } catch (error) {
    console.error('Error en petición API:', error)
    throw error
  }
}

// Función helper para peticiones GET
export const apiGet = async (url) => {
  const response = await apiRequest(url)
  if (response && response.ok) {
    return await response.json()
  }
  return null
}

// Función helper para peticiones POST
export const apiPost = async (url, data) => {
  const response = await apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data)
  })
  if (response && response.ok) {
    return await response.json()
  }
  throw new Error('Error en la petición POST')
}

// Función helper para peticiones PUT
export const apiPut = async (url, data) => {
  const response = await apiRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
  if (response && response.ok) {
    return await response.json()
  }
  throw new Error('Error en la petición PUT')
}

// Función helper para peticiones DELETE
export const apiDelete = async (url) => {
  const response = await apiRequest(url, {
    method: 'DELETE'
  })
  if (response && response.ok) {
    return await response.json()
  }
  throw new Error('Error en la petición DELETE')
}

// Función helper para subir archivos
export const apiUpload = async (url, formData) => {
  const token = localStorage.getItem('token')
  
  // Construir URL completa si es una ruta relativa
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
      // No incluir Content-Type para FormData
    },
    body: formData
  })
  
  if (response && response.ok) {
    return await response.json()
  }
  throw new Error('Error en la subida de archivo')
}