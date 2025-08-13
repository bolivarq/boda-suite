// Boda Suite API - Updated with correct credentials
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

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

// Database setup - En Vercel usaremos una base de datos en memoria
let db
let isInitialized = false

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    if (isInitialized) {
      resolve(db)
      return
    }
    
    try {
      // Usar base de datos en memoria para Vercel
      db = new (sqlite3.verbose().Database)(':memory:')
      
      console.log('Database initialized in memory for Vercel')
  
      // Initialize database tables
      db.serialize(() => {
        // Tabla de usuarios para autenticación
        db.run(`CREATE TABLE usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

        // Configuración Boda
        db.run(`CREATE TABLE configuracion_boda (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre_novia TEXT NOT NULL,
          nombre_novio TEXT NOT NULL,
          fecha_boda DATE NOT NULL,
          hora_boda TIME NOT NULL,
          lugar_boda TEXT NOT NULL,
          imagen_portada TEXT
        )`)

        // Hotel
        db.run(`CREATE TABLE hotel (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          direccion TEXT NOT NULL,
          servicios_incluidos TEXT
        )`)

        // Habitaciones
        db.run(`CREATE TABLE habitaciones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hotel_id INTEGER DEFAULT 1,
          nombre TEXT NOT NULL,
          precio DECIMAL(10,2) NOT NULL,
          capacidad INTEGER NOT NULL,
          cupos_disponibles INTEGER NOT NULL,
          FOREIGN KEY (hotel_id) REFERENCES hotel (id)
        )`)

        // Invitados
        db.run(`CREATE TABLE invitados (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          contacto TEXT NOT NULL,
          habitacion_id INTEGER,
          estado_pago TEXT DEFAULT 'Pendiente',
          FOREIGN KEY (habitacion_id) REFERENCES habitaciones (id)
        )`)

        // Pagos
        db.run(`CREATE TABLE pagos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invitado_id INTEGER NOT NULL,
          monto DECIMAL(10,2) NOT NULL,
          metodo_pago TEXT NOT NULL,
          fecha_pago DATE NOT NULL,
          saldo_pendiente DECIMAL(10,2) DEFAULT 0,
          FOREIGN KEY (invitado_id) REFERENCES invitados (id)
        )`)

        // Auditoría
        db.run(`CREATE TABLE auditoria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tabla TEXT NOT NULL,
          accion TEXT NOT NULL,
          descripcion TEXT,
          usuario_id INTEGER,
          usuario_email TEXT,
          fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

        // Insertar usuarios por defecto
        const users = [
          { email: 'admin@bodasuite.com', password: 'admin123' },
          { email: 'bolivarq@gmail.com', password: 'bq191066' }
        ]
        
        console.log('Creating default users...')
        
        let usersCreated = 0
        const totalUsers = users.length
        
        users.forEach(userData => {
          bcrypt.hash(userData.password, 10, (err, hash) => {
            if (err) {
              console.error('Error hashing password for', userData.email, ':', err)
              usersCreated++
              if (usersCreated === totalUsers) {
                isInitialized = true
                resolve(db)
              }
              return
            }
            
            console.log('Password hashed successfully for', userData.email)
            
            db.run(
              'INSERT INTO usuarios (email, password) VALUES (?, ?)',
              [userData.email, hash],
              function(err) {
                if (err) {
                  console.error('Error creating user', userData.email, ':', err.message)
                } else {
                  console.log('User created successfully:', userData.email)
                }
                
                usersCreated++
                if (usersCreated === totalUsers) {
                  isInitialized = true
                  resolve(db)
                }
              }
            )
          })
        })
      })
    } catch (error) {
      console.error('Database initialization error:', error)
      reject(error)
    }
  })
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

// Middleware para inicializar base de datos
const initializeDB = async (req, res, next) => {
  try {
    await initializeDatabase()
    next()
  } catch (error) {
    console.error('Database initialization failed:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
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

// Aplicar middleware de inicialización a todas las rutas de API
app.use('/api', initializeDB)

// API Routes

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.password })
  
  const { email, password } = req.body

  if (!email || !password) {
    console.log('Missing credentials')
    return res.status(400).json({ error: 'Email y contraseña son requeridos' })
  }

  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Error interno del servidor' })
    }

    if (!user) {
      console.log('User not found:', email)
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    console.log('User found, comparing passwords')
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Password comparison error:', err)
        return res.status(500).json({ error: 'Error interno del servidor' })
      }

      if (!isMatch) {
        console.log('Password mismatch for user:', email)
        return res.status(401).json({ error: 'Credenciales inválidas' })
      }

      console.log('Login successful for user:', email)
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

app.put('/api/habitaciones/:id', authenticateToken, (req, res) => {
  const { id } = req.params
  const { nombre, precio, capacidad, cupos_disponibles } = req.body

  if (!nombre || !precio || !capacidad || cupos_disponibles === undefined) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' })
  }

  db.run(
    'UPDATE habitaciones SET nombre = ?, precio = ?, capacidad = ?, cupos_disponibles = ? WHERE id = ?',
    [nombre, precio, capacidad, cupos_disponibles, id],
    function(err) {
      if (err) {
        console.error('Error updating room:', err.message)
        return res.status(500).json({ error: 'Error actualizando habitación' })
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Habitación no encontrada' })
      }

      registrarAuditoria('habitaciones', 'UPDATE', `Habitación actualizada: ${nombre}`, req.user.id, req.user.email)
      res.json({ message: 'Habitación actualizada exitosamente' })
    }
  )
})

app.delete('/api/habitaciones/:id', authenticateToken, (req, res) => {
  const { id } = req.params

  // Primero obtener el nombre de la habitación para la auditoría
  db.get('SELECT nombre FROM habitaciones WHERE id = ?', [id], (err, habitacion) => {
    if (err) {
      console.error('Error getting room for deletion:', err.message)
      return res.status(500).json({ error: 'Error obteniendo habitación' })
    }

    if (!habitacion) {
      return res.status(404).json({ error: 'Habitación no encontrada' })
    }

    // Verificar si hay invitados asignados a esta habitación
    db.get('SELECT COUNT(*) as count FROM invitados WHERE habitacion_id = ?', [id], (err, result) => {
      if (err) {
        console.error('Error checking room guests:', err.message)
        return res.status(500).json({ error: 'Error verificando invitados' })
      }

      if (result.count > 0) {
        return res.status(400).json({ error: 'No se puede eliminar la habitación porque tiene invitados asignados' })
      }

      // Eliminar la habitación
      db.run('DELETE FROM habitaciones WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting room:', err.message)
          return res.status(500).json({ error: 'Error eliminando habitación' })
        }

        registrarAuditoria('habitaciones', 'DELETE', `Habitación eliminada: ${habitacion.nombre}`, req.user.id, req.user.email)
        res.json({ message: 'Habitación eliminada exitosamente' })
      })
    })
  })
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

app.put('/api/invitados/:id', authenticateToken, (req, res) => {
  const { id } = req.params
  const { nombre, contacto, habitacion_id } = req.body

  if (!nombre || !contacto) {
    return res.status(400).json({ error: 'Nombre y contacto son requeridos' })
  }

  db.run(
    'UPDATE invitados SET nombre = ?, contacto = ?, habitacion_id = ? WHERE id = ?',
    [nombre, contacto, habitacion_id || null, id],
    function(err) {
      if (err) {
        console.error('Error updating guest:', err.message)
        return res.status(500).json({ error: 'Error actualizando invitado' })
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Invitado no encontrado' })
      }

      registrarAuditoria('invitados', 'UPDATE', `Invitado actualizado: ${nombre}`, req.user.id, req.user.email)
      res.json({ message: 'Invitado actualizado exitosamente' })
    }
  )
})

app.delete('/api/invitados/:id', authenticateToken, (req, res) => {
  const { id } = req.params

  // Primero obtener el nombre del invitado para la auditoría
  db.get('SELECT nombre FROM invitados WHERE id = ?', [id], (err, invitado) => {
    if (err) {
      console.error('Error getting guest for deletion:', err.message)
      return res.status(500).json({ error: 'Error obteniendo invitado' })
    }

    if (!invitado) {
      return res.status(404).json({ error: 'Invitado no encontrado' })
    }

    // Eliminar pagos asociados primero
    db.run('DELETE FROM pagos WHERE invitado_id = ?', [id], (err) => {
      if (err) {
        console.error('Error deleting guest payments:', err.message)
        return res.status(500).json({ error: 'Error eliminando pagos del invitado' })
      }

      // Luego eliminar el invitado
      db.run('DELETE FROM invitados WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting guest:', err.message)
          return res.status(500).json({ error: 'Error eliminando invitado' })
        }

        registrarAuditoria('invitados', 'DELETE', `Invitado eliminado: ${invitado.nombre}`, req.user.id, req.user.email)
        res.json({ message: 'Invitado eliminado exitosamente' })
      })
    })
  })
})

app.get('/api/invitados/:id/pagos', authenticateToken, (req, res) => {
  const { id } = req.params

  const query = `
    SELECT p.*, i.nombre as invitado_nombre
    FROM pagos p
    JOIN invitados i ON p.invitado_id = i.id
    WHERE p.invitado_id = ?
    ORDER BY p.fecha_pago DESC
  `

  db.all(query, [id], (err, rows) => {
    if (err) {
      console.error('Error getting guest payments:', err.message)
      return res.status(500).json({ error: 'Error obteniendo pagos del invitado' })
    }
    res.json(rows || [])
  })
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

// Export handler for Vercel serverless function
module.exports = async (req, res) => {
  // Initialize database on each request for serverless
  try {
    await initializeDatabase()
    return app(req, res)
  } catch (error) {
    console.error('Serverless function error:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}

// Export app for local development
module.exports.app = app

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000
  initializeDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  }).catch(error => {
    console.error('Failed to start server:', error)
  })
}