import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'

const app = express()
const PORT = 3003

// Archivo para persistencia de datos
const DATA_FILE = path.join(process.cwd(), 'test-data.json')

// Estructura de datos por defecto
const defaultData = {
  configuracion: {
    nombre_novia: '',
    nombre_novio: '',
    fecha_boda: '',
    hora_boda: '',
    lugar_boda: '',
    imagen_portada: ''
  },
  hotel: {
    nombre: '',
    direccion: '',
    servicios_incluidos: []
  },
  habitaciones: [],
  invitados: [],
  pagos: [],
  counters: {
    habitacionId: 1,
    invitadoId: 1,
    pagoId: 1
  }
}

// Cargar datos desde archivo o usar datos por defecto
let data = defaultData
try {
  if (fs.existsSync(DATA_FILE)) {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8')
    data = { ...defaultData, ...JSON.parse(fileContent) }
    console.log('Datos cargados desde archivo')
  }
} catch (error) {
  console.log('Error cargando datos, usando datos por defecto:', error.message)
  data = defaultData
}

// Función para guardar datos
const saveData = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error guardando datos:', error)
  }
}

app.use(cors())
app.use(express.json())

// Servir archivos estáticos desde dist (después del build)
app.use(express.static(path.join(process.cwd(), 'dist')))

// Servir index.html para todas las rutas que no sean API
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(process.cwd(), 'index.html'))
  }
})

app.get('/api/health', (req, res) => {
  console.log('Health check requested')
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.get('/api/verify-token', (req, res) => {
  console.log('Token verification requested')
  // Simular verificación exitosa del token
  res.json({
    valid: true,
    user: { id: 1, email: 'admin@bodasuite.com' }
  })
})

app.post('/api/login', (req, res) => {
  console.log('Login requested:', req.body)
  const { email, password } = req.body
  
  if (email === 'admin@bodasuite.com' && password === 'admin123') {
    console.log('Login successful for admin')
    res.json({
      message: 'Login exitoso',
      token: 'test-token-12345',
      user: { id: 1, email: email }
    })
  } else if (email === 'bolivarq@gmail.com' && password === 'bq191066') {
    console.log('Login successful for bolivarq')
    res.json({
      message: 'Login exitoso',
      token: 'test-token-12345',
      user: { id: 2, email: email }
    })
  } else {
    console.log('Invalid credentials:', email, password)
    res.status(401).json({ error: 'Credenciales inválidas' })
  }
})

// Rutas básicas para las otras secciones (para evitar errores 404)
app.get('/api/dashboard/stats', (req, res) => {
  console.log('Dashboard stats requested')
  const totalInvitados = data.invitados.length
  const totalRecaudado = data.pagos.reduce((sum, pago) => sum + parseFloat(pago.monto), 0)
  const totalPendiente = data.invitados.reduce((sum, inv) => sum + parseFloat(inv.saldo_pendiente || 0), 0)
  
  res.json({
    totalInvitados,
    ocupacionHotel: Math.round((totalInvitados / Math.max(data.habitaciones.reduce((sum, hab) => sum + hab.capacidad, 0), 1)) * 100),
    totalRecaudado,
    totalPendiente,
    invitadosPagados: data.invitados.filter(inv => parseFloat(inv.saldo_pendiente || 0) === 0).length,
    invitadosParciales: data.invitados.filter(inv => parseFloat(inv.saldo_pendiente || 0) > 0 && data.pagos.some(p => p.invitado_id === inv.id)).length,
    invitadosPendientes: data.invitados.filter(inv => !data.pagos.some(p => p.invitado_id === inv.id)).length
  })
})

app.get('/api/configuracion', (req, res) => {
  console.log('Configuration requested')
  res.json(data.configuracion)
})

app.post('/api/configuracion', (req, res) => {
  console.log('Configuration save requested:', req.body)
  data.configuracion = { ...data.configuracion, ...req.body }
  saveData()
  res.json({ message: 'Configuración guardada exitosamente' })
})

app.get('/api/hotel', (req, res) => {
  console.log('Hotel info requested')
  res.json(data.hotel)
})

app.post('/api/hotel', (req, res) => {
  console.log('Hotel save requested:', req.body)
  data.hotel = { ...data.hotel, ...req.body }
  saveData()
  res.json({ message: 'Información del hotel guardada exitosamente' })
})

app.get('/api/habitaciones', (req, res) => {
  console.log('Habitaciones requested')
  res.json(data.habitaciones)
})

app.post('/api/habitaciones', (req, res) => {
  console.log('Habitacion create requested:', req.body)
  const nuevaHabitacion = {
    id: data.counters.habitacionId++,
    nombre: req.body.nombre,
    precio: parseFloat(req.body.precio),
    capacidad: parseInt(req.body.capacidad),
    cupos_disponibles: parseInt(req.body.cupos_disponibles)
  }
  data.habitaciones.push(nuevaHabitacion)
  saveData()
  res.json({ message: 'Habitación agregada exitosamente', habitacion: nuevaHabitacion })
})

app.delete('/api/habitaciones/:id', (req, res) => {
  console.log('Habitacion delete requested:', req.params.id)
  const id = parseInt(req.params.id)
  data.habitaciones = data.habitaciones.filter(h => h.id !== id)
  saveData()
  res.json({ message: 'Habitación eliminada exitosamente' })
})

app.get('/api/invitados', (req, res) => {
  console.log('Invitados requested')
  res.json(data.invitados)
})

app.post('/api/invitados', (req, res) => {
  console.log('Invitado create requested:', req.body)
  const nuevoInvitado = {
    id: data.counters.invitadoId++,
    nombre: req.body.nombre,
    contacto: req.body.contacto,
    habitacion_id: req.body.habitacion_id,
    saldo_pendiente: 0 // Inicialmente sin deuda
  }
  data.invitados.push(nuevoInvitado)
  saveData()
  res.json({ message: 'Invitado agregado exitosamente', invitado: nuevoInvitado })
})

app.get('/api/pagos', (req, res) => {
  console.log('Pagos requested')
  // Enriquecer pagos con información del invitado
  const pagosConInvitado = data.pagos.map(pago => {
    const invitado = data.invitados.find(inv => inv.id === pago.invitado_id)
    return {
      ...pago,
      invitado_nombre: invitado ? invitado.nombre : 'Invitado no encontrado'
    }
  })
  res.json(pagosConInvitado)
})

app.post('/api/pagos', (req, res) => {
  console.log('Pago create requested:', req.body)
  const nuevoPago = {
    id: data.counters.pagoId++,
    invitado_id: parseInt(req.body.invitado_id),
    monto: parseFloat(req.body.monto),
    metodo_pago: req.body.metodo_pago,
    fecha_pago: req.body.fecha_pago
  }
  data.pagos.push(nuevoPago)
  
  // Actualizar saldo pendiente del invitado (simulado)
  const invitado = data.invitados.find(inv => inv.id === nuevoPago.invitado_id)
  if (invitado) {
    invitado.saldo_pendiente = Math.max(0, (invitado.saldo_pendiente || 0) - nuevoPago.monto)
  }
  
  saveData()
  res.json({ message: 'Pago registrado exitosamente', pago: nuevoPago })
})

app.delete('/api/invitados/:id', (req, res) => {
  console.log('Invitado delete requested:', req.params.id)
  const id = parseInt(req.params.id)
  data.invitados = data.invitados.filter(inv => inv.id !== id)
  // También eliminar pagos relacionados
  data.pagos = data.pagos.filter(pago => pago.invitado_id !== id)
  saveData()
  res.json({ message: 'Invitado eliminado exitosamente' })
})

app.put('/api/invitados/:id', (req, res) => {
  console.log('Invitado update requested:', req.params.id, req.body)
  const id = parseInt(req.params.id)
  const invitadoIndex = data.invitados.findIndex(inv => inv.id === id)
  
  if (invitadoIndex !== -1) {
    data.invitados[invitadoIndex] = {
      ...data.invitados[invitadoIndex],
      ...req.body
    }
    saveData()
    res.json({ message: 'Invitado actualizado exitosamente', invitado: data.invitados[invitadoIndex] })
  } else {
    res.status(404).json({ error: 'Invitado no encontrado' })
  }
})

app.get('/api/invitados/:id/pagos', (req, res) => {
  console.log('Invitado pagos requested:', req.params.id)
  const invitadoId = parseInt(req.params.id)
  const pagosInvitado = data.pagos.filter(pago => pago.invitado_id === invitadoId)
  res.json(pagosInvitado)
})

app.get('/api/auditoria', (req, res) => {
  console.log('Auditoria requested')
  // Generar datos de auditoría basados en las acciones realizadas
  const auditoria = [
    ...data.invitados.map(inv => ({
      id: `inv-${inv.id}`,
      fecha: new Date().toISOString(),
      accion: 'Invitado Creado',
      usuario: 'admin@bodasuite.com',
      detalles: `Invitado: ${inv.nombre}`
    })),
    ...data.pagos.map(pago => ({
      id: `pago-${pago.id}`,
      fecha: pago.fecha_pago,
      accion: 'Pago Registrado',
      usuario: 'admin@bodasuite.com',
      detalles: `Monto: $${pago.monto} - Método: ${pago.metodo_pago}`
    }))
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  
  res.json(auditoria)
})

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`)
})