import express from 'express'
import sqlite3 from 'sqlite3'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateRecibo, getReciboPath } from './pdfGenerator.js'
import fs from 'fs-extra'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import session from 'express-session'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, '..', 'uploads')
fs.ensureDirSync(uploadsDir)

const app = express()
const PORT = process.env.PORT || 3002

// JWT Secret (en producción debería estar en variables de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'boda-suite-secret-key-2024'

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// Session middleware
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}))

// Servir archivos estáticos del frontend en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')))
}

// Servir archivos estáticos de recibos
app.use('/recibos', express.static(path.join(__dirname, '..', 'recibos')))

// Servir archivos estáticos de imágenes
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'portada-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB límite
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false)
    }
  }
})

// Database setup
const dbPath = path.join(__dirname, 'boda_suite.db')
const db = new (sqlite3.verbose().Database)(dbPath)

// Initialize database tables
db.serialize(() => {
  // Tabla de usuarios para autenticación
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Configuración Boda
  db.run(`CREATE TABLE IF NOT EXISTS configuracion_boda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_novia TEXT NOT NULL,
    nombre_novio TEXT NOT NULL,
    fecha_boda DATE NOT NULL,
    hora_boda TIME NOT NULL,
    lugar_boda TEXT NOT NULL,
    imagen_portada TEXT
  )`)

  // Agregar columna imagen_portada si no existe
  db.run(`ALTER TABLE configuracion_boda ADD COLUMN imagen_portada TEXT`, (err) => {
    // Ignorar error si la columna ya existe
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding imagen_portada column:', err.message)
    }
  })

  // Hotel
  db.run(`CREATE TABLE IF NOT EXISTS hotel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    direccion TEXT NOT NULL,
    servicios_incluidos TEXT
  )`)

  // Habitaciones
  db.run(`CREATE TABLE IF NOT EXISTS habitaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER DEFAULT 1,
    nombre TEXT NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    capacidad INTEGER NOT NULL,
    cupos_disponibles INTEGER NOT NULL,
    FOREIGN KEY (hotel_id) REFERENCES hotel (id)
  )`)

  // Invitados
  db.run(`CREATE TABLE IF NOT EXISTS invitados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    contacto TEXT NOT NULL,
    habitacion_id INTEGER,
    estado_pago TEXT DEFAULT 'Pendiente',
    FOREIGN KEY (habitacion_id) REFERENCES habitaciones (id)
  )`)

  // Pagos
  db.run(`CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invitado_id INTEGER NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    metodo_pago TEXT NOT NULL,
    fecha_pago DATE NOT NULL,
    saldo_pendiente DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (invitado_id) REFERENCES invitados (id)
  )`)

  // Auditoría
  db.run(`CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla TEXT NOT NULL,
    accion TEXT NOT NULL,
    descripcion TEXT,
    usuario_id INTEGER,
    usuario_email TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Insertar usuario admin por defecto
  const adminEmail = 'admin@bodasuite.com'
  const adminPassword = 'admin123'
  
  bcrypt.hash(adminPassword, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err)
      return
    }
    
    db.run(
      'INSERT OR IGNORE INTO usuarios (email, password) VALUES (?, ?)',
      [adminEmail, hash],
      function(err) {
        if (err) {
          console.error('Error creating admin user:', err.message)
        } else if (this.changes > 0) {
          console.log('Admin user created successfully')
        } else {
          console.log('Admin user already exists')
        }
      }
    )
   })
 })

// Helper function to calculate payment status and pending balance
const calculatePaymentStatus = (habitacionPrecio, totalPagado) => {
  const saldoPendiente = habitacionPrecio - totalPagado
  let estadoPago = 'Pendiente'
  
  if (saldoPendiente <= 0) {
    estadoPago = 'Pagado'
  } else if (totalPagado > 0) {
    estadoPago = 'Parcial'
  }
  
  return { estadoPago, saldoPendiente: Math.max(0, saldoPendiente) }
}

// Helper function to register audit trail
const registrarAuditoria = (tabla, accion, descripcion, usuarioId, usuarioEmail) => {
  const fechaActual = new Date().toISOString()
  
  db.run(
    'INSERT INTO auditoria (tabla, accion, descripcion, usuario_id, usuario_email, fecha) VALUES (?, ?, ?, ?, ?, ?)',
    [tabla, accion, descripcion, usuarioId, usuarioEmail, fechaActual],
    function(err) {
      if (err) {
        console.error('Error registrando auditoría:', err.message)
      }
    }
  )
}

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' })
    }
    req.user = user
    next()
  })
}

// API Routes

// Rutas de autenticación
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' })
    }

    // Verificar si el usuario ya existe
    db.get('SELECT * FROM usuarios WHERE email = ?', [email], async (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: err.message })
      }

      if (existingUser) {
        return res.status(400).json({ error: 'El usuario ya existe' })
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(password, 10)

      // Crear nuevo usuario
      db.run(
        'INSERT INTO usuarios (email, password) VALUES (?, ?)',
        [email, hashedPassword],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message })
          }

          // Generar token JWT
          const token = jwt.sign(
            { id: this.lastID, email: email },
            JWT_SECRET,
            { expiresIn: '24h' }
          )

          res.json({
            message: 'Usuario registrado exitosamente',
            token: token,
            user: { id: this.lastID, email: email }
          })
        }
      )
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' })
    }

    // Buscar usuario
    db.get('SELECT * FROM usuarios WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message })
      }

      if (!user) {
        return res.status(400).json({ error: 'Credenciales inválidas' })
      }

      // Verificar contraseña
      const validPassword = await bcrypt.compare(password, user.password)
      if (!validPassword) {
        return res.status(400).json({ error: 'Credenciales inválidas' })
      }

      // Generar token JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      )

      res.json({
        message: 'Inicio de sesión exitoso',
        token: token,
        user: { id: user.id, email: user.email }
      })
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Ruta para verificar si el usuario está autenticado
app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({ 
    valid: true, 
    user: { id: req.user.id, email: req.user.email } 
  })
})

// Dashboard Stats (protegida)
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  // Consulta simplificada para contar invitados y estados
  const statsQuery = `
    SELECT 
      COUNT(*) as totalInvitados,
      SUM(CASE WHEN estado_pago = 'Pagado' THEN 1 ELSE 0 END) as invitadosPagados,
      SUM(CASE WHEN estado_pago = 'Parcial' THEN 1 ELSE 0 END) as invitadosParciales,
      SUM(CASE WHEN estado_pago = 'Pendiente' THEN 1 ELSE 0 END) as invitadosPendientes
    FROM invitados
  `
  
  // Consulta separada para totales de dinero
  const moneyQuery = `
    SELECT 
      COALESCE(SUM(p.monto), 0) as totalRecaudado
    FROM pagos p
  `
  
  // Consulta para calcular total pendiente
  const pendingQuery = `
    SELECT 
      COALESCE(SUM(h.precio - COALESCE(pagos_totales.total_pagado, 0)), 0) as totalPendiente
    FROM invitados i
    LEFT JOIN habitaciones h ON i.habitacion_id = h.id
    LEFT JOIN (
      SELECT invitado_id, SUM(monto) as total_pagado
      FROM pagos
      GROUP BY invitado_id
    ) pagos_totales ON i.id = pagos_totales.invitado_id
  `
  
  db.get(statsQuery, (err, statsRow) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    db.get(moneyQuery, (err2, moneyRow) => {
      if (err2) {
        res.status(500).json({ error: err2.message })
        return
      }
      
      db.get(pendingQuery, (err3, pendingRow) => {
        if (err3) {
          res.status(500).json({ error: err3.message })
          return
        }
        
        // Calculate hotel occupancy
        const ocupacionQuery = `
          SELECT 
            COALESCE(SUM(h.cupos_disponibles), 0) as totalCupos,
            COUNT(i.id) as invitadosAsignados
          FROM habitaciones h
          LEFT JOIN invitados i ON h.id = i.habitacion_id
        `
        
        db.get(ocupacionQuery, (err4, ocupacionRow) => {
          if (err4) {
            res.status(500).json({ error: err4.message })
            return
          }
          
          const ocupacionHotel = ocupacionRow.totalCupos > 0 
            ? Math.round((ocupacionRow.invitadosAsignados / ocupacionRow.totalCupos) * 100)
            : 0
          
          res.json({
            totalInvitados: statsRow.totalInvitados || 0,
            ocupacionHotel,
            totalRecaudado: moneyRow.totalRecaudado || 0,
            totalPendiente: pendingRow.totalPendiente || 0,
            invitadosPagados: statsRow.invitadosPagados || 0,
            invitadosParciales: statsRow.invitadosParciales || 0,
            invitadosPendientes: statsRow.invitadosPendientes || 0
          })
        })
      })
    })
  })
})

// Configuración (protegida)
app.get('/api/configuracion', authenticateToken, (req, res) => {
  db.get('SELECT * FROM configuracion_boda ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    res.json(row || {})
  })
})

app.post('/api/configuracion', authenticateToken, (req, res) => {
  const { nombre_novia, nombre_novio, fecha_boda, hora_boda, lugar_boda, imagen_portada } = req.body
  const userId = req.user.id
  const userEmail = req.user.email
  const fechaActual = new Date().toISOString()
  
  // Delete existing configuration and insert new one
  db.run('DELETE FROM configuracion_boda', (err) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    db.run(
      'INSERT INTO configuracion_boda (nombre_novia, nombre_novio, fecha_boda, hora_boda, lugar_boda, imagen_portada, creado_por, creado_por_email, fecha_creacion, modificado_por, modificado_por_email, fecha_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nombre_novia, nombre_novio, fecha_boda, hora_boda, lugar_boda, imagen_portada, userId, userEmail, fechaActual, userId, userEmail, fechaActual],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message })
          return
        }
        
        // Registrar auditoría
        const descripcionAuditoria = `Configuración de boda actualizada: ${nombre_novia} & ${nombre_novio} - Fecha: ${fecha_boda}`
        registrarAuditoria('configuracion_boda', 'CREATE', descripcionAuditoria, userId, userEmail)
        
        res.json({ id: this.lastID })
      }
    )
  })
})

// Ruta para subir imagen de portada (protegida)
app.post('/api/upload-portada', authenticateToken, upload.single('imagen'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo' })
    }
    
    const fileName = req.file.filename
    const filePath = `/uploads/${fileName}`
    
    res.json({ 
      success: true, 
      fileName: fileName,
      filePath: filePath,
      message: 'Imagen subida exitosamente' 
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Hotel (protegida)
app.get('/api/hotel', authenticateToken, (req, res) => {
  db.get('SELECT * FROM hotel ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    if (row && row.servicios_incluidos) {
      row.servicios_incluidos = JSON.parse(row.servicios_incluidos)
    }
    res.json(row || {})
  })
})

app.post('/api/hotel', authenticateToken, (req, res) => {
  const { nombre, direccion, servicios_incluidos } = req.body
  const serviciosJson = JSON.stringify(servicios_incluidos || [])
  const userId = req.user.id
  const userEmail = req.user.email
  const fechaActual = new Date().toISOString()
  
  // Delete existing hotel and insert new one
  db.run('DELETE FROM hotel', (err) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    db.run(
      'INSERT INTO hotel (nombre, direccion, servicios_incluidos, creado_por, creado_por_email, fecha_creacion, modificado_por, modificado_por_email, fecha_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nombre, direccion, serviciosJson, userId, userEmail, fechaActual, userId, userEmail, fechaActual],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message })
          return
        }
        
        // Registrar auditoría
        const descripcionAuditoria = `Hotel configurado: ${nombre} - Dirección: ${direccion}`
        registrarAuditoria('hotel', 'CREATE', descripcionAuditoria, userId, userEmail)
        
        res.json({ id: this.lastID })
      }
    )
  })
})

// Habitaciones (protegidas)
app.get('/api/habitaciones', authenticateToken, (req, res) => {
  db.all('SELECT * FROM habitaciones ORDER BY nombre', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    res.json(rows)
  })
})

app.post('/api/habitaciones', authenticateToken, (req, res) => {
  const { nombre, precio, capacidad, cupos_disponibles } = req.body
  const userId = req.user.id
  const userEmail = req.user.email
  const fechaActual = new Date().toISOString()
  
  db.run(
    'INSERT INTO habitaciones (nombre, precio, capacidad, cupos_disponibles, creado_por, creado_por_email, fecha_creacion, modificado_por, modificado_por_email, fecha_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [nombre, precio, capacidad, cupos_disponibles, userId, userEmail, fechaActual, userId, userEmail, fechaActual],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      // Registrar auditoría
      const descripcionAuditoria = `Habitación creada: ${nombre} - Precio: $${precio} - Capacidad: ${capacidad}`
      registrarAuditoria('habitaciones', 'CREATE', descripcionAuditoria, userId, userEmail)
      
      res.json({ id: this.lastID })
    }
  )
})

app.put('/api/habitaciones/:id', authenticateToken, (req, res) => {
  const { nombre, precio, capacidad, cupos_disponibles } = req.body
  const { id } = req.params
  const userId = req.user.id
  const userEmail = req.user.email
  const fechaActual = new Date().toISOString()
  
  db.run(
    'UPDATE habitaciones SET nombre = ?, precio = ?, capacidad = ?, cupos_disponibles = ?, modificado_por = ?, modificado_por_email = ?, fecha_modificacion = ? WHERE id = ?',
    [nombre, precio, capacidad, cupos_disponibles, userId, userEmail, fechaActual, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      // Registrar auditoría
      const descripcionAuditoria = `Habitación actualizada: ${nombre} - Precio: $${precio} - Capacidad: ${capacidad}`
      registrarAuditoria('habitaciones', 'UPDATE', descripcionAuditoria, userId, userEmail)
      
      res.json({ changes: this.changes })
    }
  )
})

app.delete('/api/habitaciones/:id', authenticateToken, (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  const userEmail = req.user.email
  
  // Obtener nombre de la habitación antes de eliminarla
  db.get('SELECT nombre FROM habitaciones WHERE id = ?', [id], (err, habitacion) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    const nombreHabitacion = habitacion ? habitacion.nombre : 'Desconocida'
    
    db.run('DELETE FROM habitaciones WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      // Registrar auditoría
      const descripcionAuditoria = `Habitación eliminada: ${nombreHabitacion}`
      registrarAuditoria('habitaciones', 'DELETE', descripcionAuditoria, userId, userEmail)
      
      res.json({ changes: this.changes })
    })
  })
})

// Invitados
app.get('/api/invitados', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      i.*,
      h.nombre as habitacion_nombre,
      h.precio as habitacion_precio,
      COALESCE(pagos_totales.total_pagado, 0) as total_pagado,
      (h.precio - COALESCE(pagos_totales.total_pagado, 0)) as saldo_pendiente
    FROM invitados i
    LEFT JOIN habitaciones h ON i.habitacion_id = h.id
    LEFT JOIN (
      SELECT invitado_id, SUM(monto) as total_pagado
      FROM pagos
      GROUP BY invitado_id
    ) pagos_totales ON i.id = pagos_totales.invitado_id
    ORDER BY i.nombre
  `
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    // Update payment status for each guest
    const updatePromises = rows.map(row => {
      return new Promise((resolve) => {
        const { estadoPago, saldoPendiente } = calculatePaymentStatus(
          row.habitacion_precio || 0,
          row.total_pagado || 0
        )
        
        db.run(
          'UPDATE invitados SET estado_pago = ? WHERE id = ?',
          [estadoPago, row.id],
          () => {
            row.estado_pago = estadoPago
            row.saldo_pendiente = saldoPendiente
            resolve()
          }
        )
      })
    })
    
    Promise.all(updatePromises).then(() => {
      res.json(rows)
    })
  })
})

app.post('/api/invitados', authenticateToken, (req, res) => {
  const { nombre, contacto, habitacion_id } = req.body
  const userId = req.user.id
  const userEmail = req.user.email
  const fechaActual = new Date().toISOString()
  
  db.run(
    'INSERT INTO invitados (nombre, contacto, habitacion_id, creado_por, creado_por_email, fecha_creacion, modificado_por, modificado_por_email, fecha_modificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [nombre, contacto, habitacion_id, userId, userEmail, fechaActual, userId, userEmail, fechaActual],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      // Registrar auditoría
      const descripcionAuditoria = `Invitado creado: ${nombre} - Contacto: ${contacto}`
      registrarAuditoria('invitados', 'CREATE', descripcionAuditoria, userId, userEmail)
      
      res.json({ id: this.lastID })
    }
  )
})

app.put('/api/invitados/:id', authenticateToken, (req, res) => {
  const { nombre, contacto, habitacion_id } = req.body
  const { id } = req.params
  const userId = req.user.id
  const userEmail = req.user.email
  const fechaActual = new Date().toISOString()
  
  db.run(
    'UPDATE invitados SET nombre = ?, contacto = ?, habitacion_id = ?, modificado_por = ?, modificado_por_email = ?, fecha_modificacion = ? WHERE id = ?',
    [nombre, contacto, habitacion_id, userId, userEmail, fechaActual, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      // Registrar auditoría
      const descripcionAuditoria = `Invitado actualizado: ${nombre} - Contacto: ${contacto}`
      registrarAuditoria('invitados', 'UPDATE', descripcionAuditoria, userId, userEmail)
      
      res.json({ changes: this.changes })
    }
  )
})

app.delete('/api/invitados/:id', authenticateToken, (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  const userEmail = req.user.email
  
  // Obtener nombre del invitado antes de eliminarlo
  db.get('SELECT nombre FROM invitados WHERE id = ?', [id], (err, invitado) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    const nombreInvitado = invitado ? invitado.nombre : 'Desconocido'
    
    // First delete related payments
    db.run('DELETE FROM pagos WHERE invitado_id = ?', [id], (err) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      // Then delete the guest
      db.run('DELETE FROM invitados WHERE id = ?', [id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message })
          return
        }
        
        // Registrar auditoría
        const descripcionAuditoria = `Invitado eliminado: ${nombreInvitado}`
        registrarAuditoria('invitados', 'DELETE', descripcionAuditoria, userId, userEmail)
        
        res.json({ changes: this.changes })
      })
    })
  })
})

// Get payments for a specific guest
app.get('/api/invitados/:id/pagos', authenticateToken, (req, res) => {
  const { id } = req.params
  
  db.all(
    'SELECT * FROM pagos WHERE invitado_id = ? ORDER BY fecha_pago DESC',
    [id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      res.json(rows)
    }
  )
})

// Pagos
app.get('/api/pagos', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      p.*,
      i.nombre as invitado_nombre,
      h.precio as habitacion_precio,
      (h.precio - COALESCE(pagos_totales.total_pagado, 0)) as saldo_pendiente
    FROM pagos p
    LEFT JOIN invitados i ON p.invitado_id = i.id
    LEFT JOIN habitaciones h ON i.habitacion_id = h.id
    LEFT JOIN (
      SELECT invitado_id, SUM(monto) as total_pagado
      FROM pagos
      GROUP BY invitado_id
    ) pagos_totales ON i.id = pagos_totales.invitado_id
    ORDER BY p.fecha_pago DESC
  `
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    res.json(rows)
  })
})

app.post('/api/pagos', authenticateToken, async (req, res) => {
  const { invitado_id, monto, metodo_pago, fecha_pago } = req.body
  const userId = req.user.id
  const userEmail = req.user.email
  const fechaActual = new Date().toISOString()
  
  try {
    // Obtener nombre del invitado para la auditoría
    const invitadoNombre = await new Promise((resolve, reject) => {
      db.get('SELECT nombre FROM invitados WHERE id = ?', [invitado_id], (err, row) => {
        if (err) reject(err)
        else resolve(row ? row.nombre : 'Desconocido')
      })
    })
    
    // Insertar el pago
    const pagoResult = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO pagos (invitado_id, monto, metodo_pago, fecha_pago, creado_por, creado_por_email, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [invitado_id, monto, metodo_pago, fecha_pago, userId, userEmail, fechaActual],
        function(err) {
          if (err) reject(err)
          else resolve({ id: this.lastID })
        }
      )
    })
    
    // Registrar auditoría del pago
    const descripcionAuditoria = `Pago registrado para ${invitadoNombre} - Monto: $${monto} - Método: ${metodo_pago}`
    registrarAuditoria('pagos', 'CREATE', descripcionAuditoria, userId, userEmail)
    
    // Obtener datos del invitado con información actualizada
    const invitadoData = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          i.*,
          h.nombre as habitacion_nombre,
          h.precio as habitacion_precio,
          h.precio as total_a_pagar,
          COALESCE(pagos_totales.total_pagado, 0) as total_pagado,
          (h.precio - COALESCE(pagos_totales.total_pagado, 0)) as saldo_pendiente
        FROM invitados i
        LEFT JOIN habitaciones h ON i.habitacion_id = h.id
        LEFT JOIN (
          SELECT invitado_id, SUM(monto) as total_pagado
          FROM pagos
          WHERE invitado_id = ?
          GROUP BY invitado_id
        ) pagos_totales ON i.id = pagos_totales.invitado_id
        WHERE i.id = ?
      `
      
      db.get(query, [invitado_id, invitado_id], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
    
    // Obtener configuración de la boda
    const configuracionData = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM configuracion_boda LIMIT 1', (err, row) => {
        if (err) reject(err)
        else resolve(row || {})
      })
    })
    
    // Obtener datos del hotel
    const hotelData = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM hotel LIMIT 1', (err, row) => {
        if (err) reject(err)
        else resolve(row || {})
      })
    })
    
    // Generar recibo PDF
    const pagoData = {
      id: pagoResult.id,
      monto: parseFloat(monto),
      metodo_pago,
      fecha_pago
    }
    
    const reciboInfo = await generateRecibo(pagoData, invitadoData, configuracionData, hotelData)
    
    // Actualizar estado de pago del invitado
    const updateQuery = `
      UPDATE invitados 
      SET estado_pago = (
        SELECT CASE 
          WHEN h.precio <= COALESCE(pagos_totales.total_pagado, 0) THEN 'Pagado'
          WHEN COALESCE(pagos_totales.total_pagado, 0) > 0 THEN 'Parcial'
          ELSE 'Pendiente'
        END
        FROM habitaciones h
        LEFT JOIN (
          SELECT invitado_id, SUM(monto) as total_pagado
          FROM pagos
          WHERE invitado_id = ?
          GROUP BY invitado_id
        ) pagos_totales ON pagos_totales.invitado_id = ?
        WHERE h.id = invitados.habitacion_id
      )
      WHERE id = ?
    `
    
    await new Promise((resolve, reject) => {
      db.run(updateQuery, [invitado_id, invitado_id, invitado_id], (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    
    res.json({ 
      id: pagoResult.id,
      recibo: reciboInfo
    })
    
  } catch (error) {
    console.error('Error creating payment:', error)
    res.status(500).json({ error: error.message })
  }
})

// Ruta para regenerar recibo de un pago existente
app.post('/api/pagos/regenerar-recibo', authenticateToken, async (req, res) => {
  const { pagoId } = req.body
  
  try {
    // Obtener datos del pago
    const pagoData = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM pagos WHERE id = ?', [pagoId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
    
    if (!pagoData) {
      return res.status(404).json({ error: 'Pago no encontrado' })
    }
    
    // Obtener datos del invitado con información actualizada
    const invitadoData = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          i.*,
          h.nombre as habitacion_nombre,
          h.precio as habitacion_precio,
          h.precio as total_a_pagar,
          COALESCE(pagos_totales.total_pagado, 0) as total_pagado,
          (h.precio - COALESCE(pagos_totales.total_pagado, 0)) as saldo_pendiente
        FROM invitados i
        LEFT JOIN habitaciones h ON i.habitacion_id = h.id
        LEFT JOIN (
          SELECT invitado_id, SUM(monto) as total_pagado
          FROM pagos
          WHERE invitado_id = ?
          GROUP BY invitado_id
        ) pagos_totales ON i.id = pagos_totales.invitado_id
        WHERE i.id = ?
      `
      
      db.get(query, [pagoData.invitado_id, pagoData.invitado_id], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
    
    // Obtener configuración de la boda
    const configuracionData = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM configuracion_boda LIMIT 1', (err, row) => {
        if (err) reject(err)
        else resolve(row || {})
      })
    })
    
    // Obtener datos del hotel
    const hotelData = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM hotel LIMIT 1', (err, row) => {
        if (err) reject(err)
        else resolve(row || {})
      })
    })
    
    // Generar recibo PDF
    const reciboInfo = await generateRecibo(pagoData, invitadoData, configuracionData, hotelData)
    
    res.json({ recibo: reciboInfo })
    
  } catch (error) {
    console.error('Error regenerating recibo:', error)
    res.status(500).json({ error: error.message })
  }
})

// Ruta para descargar recibos
app.get('/api/recibos/:fileName', authenticateToken, (req, res) => {
  const { fileName } = req.params
  const filePath = getReciboPath(fileName)
  
  res.download(filePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Recibo no encontrado' })
    }
  })
})

// Ruta para obtener datos de auditoría
app.get('/api/auditoria', authenticateToken, (req, res) => {
  // Primero intentar obtener de la tabla auditoria
  db.all('SELECT * FROM auditoria ORDER BY fecha DESC LIMIT 500', (err, auditRows) => {
    if (err) {
      console.error('Error fetching audit data from auditoria table:', err)
      // Si falla, usar la consulta UNION como respaldo
      const auditQuery = `
        SELECT 
          'configuracion_boda' as tabla,
          id as registro_id,
          'UPDATE' as accion,
          'Configuración de boda actualizada' as descripcion,
          creado_por,
          creado_por_email,
          fecha_creacion,
          modificado_por,
          modificado_por_email,
          fecha_modificacion
        FROM configuracion_boda
        WHERE creado_por IS NOT NULL OR modificado_por IS NOT NULL
        
        UNION ALL
        
        SELECT 
          'hotel' as tabla,
          id as registro_id,
          'UPDATE' as accion,
          'Información del hotel actualizada: ' || nombre as descripcion,
          creado_por,
          creado_por_email,
          fecha_creacion,
          modificado_por,
          modificado_por_email,
          fecha_modificacion
        FROM hotel
        WHERE creado_por IS NOT NULL OR modificado_por IS NOT NULL
        
        UNION ALL
        
        SELECT 
          'habitaciones' as tabla,
          id as registro_id,
          'UPDATE' as accion,
          'Habitación actualizada: ' || nombre as descripcion,
          creado_por,
          creado_por_email,
          fecha_creacion,
          modificado_por,
          modificado_por_email,
          fecha_modificacion
        FROM habitaciones
        WHERE creado_por IS NOT NULL OR modificado_por IS NOT NULL
        
        UNION ALL
        
        SELECT 
          'invitados' as tabla,
          id as registro_id,
          'UPDATE' as accion,
          'Invitado gestionado: ' || nombre as descripcion,
          creado_por,
          creado_por_email,
          fecha_creacion,
          modificado_por,
          modificado_por_email,
          fecha_modificacion
        FROM invitados
        WHERE creado_por IS NOT NULL OR modificado_por IS NOT NULL
        
        UNION ALL
        
        SELECT 
          'pagos' as tabla,
          id as registro_id,
          'CREATE' as accion,
          'Pago registrado: $' || monto || ' (' || metodo_pago || ')' as descripcion,
          creado_por,
          creado_por_email,
          fecha_creacion,
          creado_por as modificado_por,
          creado_por_email as modificado_por_email,
          fecha_creacion as fecha_modificacion
        FROM pagos
        WHERE creado_por IS NOT NULL
        
        ORDER BY 
          CASE 
            WHEN fecha_modificacion IS NOT NULL THEN fecha_modificacion
            ELSE fecha_creacion
          END DESC
        LIMIT 500
      `
      
      db.all(auditQuery, (err2, rows) => {
        if (err2) {
          console.error('Error fetching audit data from UNION query:', err2)
          res.status(500).json({ error: err2.message })
          return
        }
        res.json(rows || [])
      })
    } else {
      // Si la tabla auditoria existe y tiene datos, usarla
      res.json(auditRows || [])
    }
  })
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Catch-all handler: send back React's index.html file in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'))
  })
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})