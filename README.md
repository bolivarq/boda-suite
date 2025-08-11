# Boda Suite

Una aplicación web elegante para gestionar una boda y hotel, permitiendo administrar invitados, pagos y habitaciones desde un único panel de control.

## Características

- **Dashboard**: Vista general con métricas en tiempo real
- **Gestión de Invitados**: Lista filtrable con estados de pago
- **Registro de Pagos**: Múltiples métodos de pago y seguimiento
- **Configuración**: Edición de datos de la boda, hotel y habitaciones
- **Interfaz Responsive**: Optimizada para móvil y escritorio
- **Diseño Elegante**: Colores suaves (blanco, dorado, beige)

## Tecnologías

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Node.js, Express
- **Base de Datos**: SQLite
- **Iconos**: Lucide React

## Instalación

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar el servidor backend**:
   ```bash
   npm run server
   ```

3. **Iniciar el frontend** (en otra terminal):
   ```bash
   npm run dev
   ```

4. **Abrir la aplicación**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Estructura de Datos

### Configuración Boda
- Nombres de los novios
- Fecha, hora y lugar de la boda

### Hotel
- Nombre y dirección
- Servicios incluidos

### Habitaciones
- Nombre, precio, capacidad
- Cupos disponibles

### Invitados
- Información de contacto
- Asignación de habitación
- Estado de pago (Pagado, Parcial, Pendiente)

### Pagos
- Monto y método de pago
- Fecha de pago
- Cálculo automático de saldo pendiente

## Funcionalidades

### Dashboard
- Total de invitados confirmados
- Ocupación del hotel (%)
- Total recaudado y saldo pendiente
- Accesos rápidos a funciones principales

### Gestión de Invitados
- Lista filtrable por estado de pago y habitación
- Vista detalle con historial de pagos
- Agregar, editar y eliminar invitados

### Registro de Pagos
- Múltiples métodos: Efectivo, Transferencia, Tarjeta, Zelle, Paypal
- Búsqueda por invitado y filtros por fecha
- Cálculo automático de saldos

### Configuración
- Editar datos de la boda
- Gestionar información del hotel
- Administrar tipos de habitaciones

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo frontend
- `npm run build`: Construye la aplicación para producción
- `npm run preview`: Vista previa de la build de producción
- `npm run server`: Inicia el servidor backend

## Base de Datos

La aplicación utiliza SQLite con las siguientes tablas:
- `configuracion_boda`
- `hotel`
- `habitaciones`
- `invitados`
- `pagos`

La base de datos se crea automáticamente al iniciar el servidor.

## Cálculos Automáticos

- **Saldo pendiente**: Precio habitación - suma de pagos
- **Ocupación**: Número de invitados / cupos totales
- **Estado de pago**: Automático basado en pagos vs precio habitación
- **Totales**: Recaudado y pendiente en tiempo real