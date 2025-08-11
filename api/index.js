const express = require('express')
const sqlite3 = require('sqlite3')
const cors = require('cors')
const path = require('path')
const fs = require('fs-extra')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const app = express()

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'boda-suite-secret-key-2024'

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// Database setup - En Vercel usaremos una base de datos temporal
let db
try {
  const dbPath = '/tmp/boda_suite.db'
  db = new (sqlite3.verbose().Database)(dbPath)
  
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
          }
        }
      )
    })
  })
} catch (error) {
  console.error('Database initialization error:', error)
}

// Helper functions
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

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' })
  }

  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Error interno del servidor' })
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Password comparison error:', err)
        return res.status(500).json({ error: 'Error interno del servidor' })
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Credenciales inválidas' })
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      )

      res.json({
        message: 'Login exitoso',
        token,
        user: {
          id: user.id,
          email: user.email
        }
      })
    })
  })
})

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
  }

  // Verificar si el usuario ya existe
  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, existingUser) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Error interno del servidor' })
    }

    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' })
    }

    // Hash de la contraseña
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Password hashing error:', err)
        return res.status(500).json({ error: 'Error interno del servidor' })
      }

      // Crear nuevo usuario
      db.run(
        'INSERT INTO usuarios (email, password) VALUES (?, ?)',
        [email, hashedPassword],
        function(err) {
          if (err) {
            console.error('Error creating user:', err.message)
            return res.status(500).json({ error: 'Error creando usuario' })
          }

          const token = jwt.sign(
            { id: this.lastID, email: email },
            JWT_SECRET,
            { expiresIn: '24h' }
          )

          res.json({
            message: 'Usuario registrado exitosamente',
            token,
            user: {
              id: this.lastID,
              email: email
            }
          })
        }
      )
    })
  })
})

// Token verification route
app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      email: req.user.email
    }
  })
})

// Dashboard Routes
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const queries = [
    'SELECT COUNT(*) as total FROM invitados',
    'SELECT COUNT(*) as confirmados FROM invitados WHERE habitacion_id IS NOT NULL',
    'SELECT COUNT(*) as pagados FROM invitados WHERE estado_pago = "Pagado"',
    'SELECT SUM(monto) as ingresos FROM pagos'
  ]

  Promise.all(queries.map(query => 
    new Promise((resolve, reject) => {
      db.get(query, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  )).then(results => {
    res.json({
      totalInvitados: results[0].total || 0,
      invitadosConfirmados: results[1].confirmados || 0,
      pagosPagados: results[2].pagados || 0,
      ingresosTotales: results[3].ingresos || 0
    })
  }).catch(err => {
    console.error('Error getting dashboard stats:', err.message)
    res.status(500).json({ error: 'Error obteniendo estadísticas' })
  })
})

// Configuración Routes
app.get('/api/configuracion', authenticateToken, (req, res) => {
  db.get('SELECT * FROM configuracion_boda ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      console.error('Error getting configuration:', err.message)
      return res.status(500).json({ error: 'Error obteniendo configuración' })
    }
    res.json(row || {})
  })
})

app.post('/api/configuracion', authenticateToken, (req, res) => {
  const { nombre_novia, nombre_novio, fecha_boda, hora_boda, lugar_boda } = req.body

  if (!nombre_novia || !nombre_novio || !fecha_boda || !hora_boda || !lugar_boda) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' })
  }

  db.run(
    'INSERT OR REPLACE INTO configuracion_boda (id, nombre_novia, nombre_novio, fecha_boda, hora_boda, lugar_boda) VALUES (1, ?, ?, ?, ?, ?)',
    [nombre_novia, nombre_novio, fecha_boda, hora_boda, lugar_boda],
    function(err) {
      if (err) {
        console.error('Error saving configuration:', err.message)
        return res.status(500).json({ error: 'Error guardando configuración' })
      }

      registrarAuditoria('configuracion_boda', 'UPDATE', 'Configuración de boda actualizada', req.user.id, req.user.email)
      res.json({ message: 'Configuración guardada exitosamente' })
    }
  )
})

// Hotel Routes
app.get('/api/hotel', authenticateToken, (req, res) => {
  db.get('SELECT * FROM hotel ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      console.error('Error getting hotel:', err.message)
      return res.status(500).json({ error: 'Error obteniendo información del hotel' })
    }
    res.json(row || {})
  })
})

app.post('/api/hotel', authenticateToken, (req, res) => {
  const { nombre, direccion, servicios_incluidos } = req.body

  if (!nombre || !direccion) {
    return res.status(400).json({ error: 'Nombre y dirección son requeridos' })
  }

  db.run(
    'INSERT OR REPLACE INTO hotel (id, nombre, direccion, servicios_incluidos) VALUES (1, ?, ?, ?)',
    [nombre, direccion, servicios_incluidos || ''],
    function(err) {
      if (err) {
        console.error('Error saving hotel:', err.message)
        return res.status(500).json({ error: 'Error guardando información del hotel' })
      }

      registrarAuditoria('hotel', 'UPDATE', 'Información del hotel actualizada', req.user.id, req.user.email)
      res.json({ message: 'Información del hotel guardada exitosamente' })
    }
  )
})

// Habitaciones Routes
app.get('/api/habitaciones', authenticateToken, (req, res) => {
  db.all('SELECT * FROM habitaciones ORDER BY nombre', (err, rows) => {
    if (err) {
      console.error('Error getting rooms:', err.message)
      return res.status(500).json({ error: 'Error obteniendo habitaciones' })
    }
    res.json(rows || [])
  })
})

app.post('/api/habitaciones', authenticateToken, (req, res) => {
  const { nombre, precio, capacidad, cupos_disponibles } = req.body

  if (!nombre || !precio || !capacidad || cupos_disponibles === undefined) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' })
  }

  db.run(
    'INSERT INTO habitaciones (nombre, precio, capacidad, cupos_disponibles) VALUES (?, ?, ?, ?)',
    [nombre, precio, capacidad, cupos_disponibles],
    function(err) {
      if (err) {
        console.error('Error creating room:', err.message)
        return res.status(500).json({ error: 'Error creando habitación' })
      }

      registrarAuditoria('habitaciones', 'CREATE', `Habitación creada: ${nombre}`, req.user.id, req.user.email)
      res.json({ message: 'Habitación creada exitosamente', id: this.lastID })
    }
  )
})

// Invitados Routes
app.get('/api/invitados', authenticateToken, (req, res) => {
  const query = `
    SELECT i.*, h.nombre as habitacion_nombre, h.precio as habitacion_precio,
           COALESCE(SUM(p.monto), 0) as total_pagado
    FROM invitados i
    LEFT JOIN habitaciones h ON i.habitacion_id = h.id
    LEFT JOIN pagos p ON i.id = p.invitado_id
    GROUP BY i.id
    ORDER BY i.nombre
  `

  db.all(query, (err, rows) => {
    if (err) {
      console.error('Error getting guests:', err.message)
      return res.status(500).json({ error: 'Error obteniendo invitados' })
    }

    const invitados = rows.map(row => {
      if (row.habitacion_precio) {
        const { estadoPago, saldoPendiente } = calculatePaymentStatus(row.habitacion_precio, row.total_pagado)
        return {
          ...row,
          estado_pago: estadoPago,
          saldo_pendiente: saldoPendiente
        }
      }
      return row
    })

    res.json(invitados || [])
  })
})

app.post('/api/invitados', authenticateToken, (req, res) => {
  const { nombre, contacto, habitacion_id } = req.body

  if (!nombre || !contacto) {
    return res.status(400).json({ error: 'Nombre y contacto son requeridos' })
  }

  db.run(
    'INSERT INTO invitados (nombre, contacto, habitacion_id) VALUES (?, ?, ?)',
    [nombre, contacto, habitacion_id || null],
    function(err) {
      if (err) {
        console.error('Error creating guest:', err.message)
        return res.status(500).json({ error: 'Error creando invitado' })
      }

      registrarAuditoria('invitados', 'CREATE', `Invitado creado: ${nombre}`, req.user.id, req.user.email)
      res.json({ message: 'Invitado creado exitosamente', id: this.lastID })
    }
  )
})

// Pagos Routes
app.get('/api/pagos', authenticateToken, (req, res) => {
  const query = `
    SELECT p.*, i.nombre as invitado_nombre
    FROM pagos p
    JOIN invitados i ON p.invitado_id = i.id
    ORDER BY p.fecha_pago DESC
  `

  db.all(query, (err, rows) => {
    if (err) {
      console.error('Error getting payments:', err.message)
      return res.status(500).json({ error: 'Error obteniendo pagos' })
    }
    res.json(rows || [])
  })
})

app.post('/api/pagos', authenticateToken, (req, res) => {
  const { invitado_id, monto, metodo_pago, fecha_pago } = req.body

  if (!invitado_id || !monto || !metodo_pago || !fecha_pago) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' })
  }

  db.run(
    'INSERT INTO pagos (invitado_id, monto, metodo_pago, fecha_pago) VALUES (?, ?, ?, ?)',
    [invitado_id, monto, metodo_pago, fecha_pago],
    function(err) {
      if (err) {
        console.error('Error creating payment:', err.message)
        return res.status(500).json({ error: 'Error registrando pago' })
      }

      registrarAuditoria('pagos', 'CREATE', `Pago registrado: $${monto}`, req.user.id, req.user.email)
      res.json({ message: 'Pago registrado exitosamente', id: this.lastID })
    }
  )
})

// Auditoría Routes
app.get('/api/auditoria', authenticateToken, (req, res) => {
  db.all('SELECT * FROM auditoria ORDER BY fecha DESC LIMIT 100', (err, rows) => {
    if (err) {
      console.error('Error getting audit trail:', err.message)
      return res.status(500).json({ error: 'Error obteniendo auditoría' })
    }
    res.json(rows || [])
  })
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Boda Suite API is running' })
})

// Export for Vercel
module.exports = app