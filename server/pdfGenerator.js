import PDFDocument from 'pdfkit'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Crear directorio de recibos si no existe
const recibosDir = path.join(__dirname, '..', 'recibos')
fs.ensureDirSync(recibosDir)

export const generateRecibo = async (pagoData, invitadoData, configuracionData, hotelData) => {
  return new Promise((resolve, reject) => {
    try {
      // Crear documento PDF
      const doc = new PDFDocument({ margin: 50 })
      
      // Nombre del archivo
      const fileName = `recibo_${invitadoData.nombre.replace(/\s+/g, '_')}_${Date.now()}.pdf`
      const filePath = path.join(recibosDir, fileName)
      
      // Stream para escribir el archivo
      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)
      
      // Configurar fuentes y colores
      const primaryColor = '#D4AF37' // Dorado
      const textColor = '#2D3748'
      
      // Encabezado
      doc.fontSize(24)
         .fillColor(primaryColor)
         .text('RECIBO DE PAGO', 50, 50, { align: 'center' })
      
      doc.fontSize(16)
         .fillColor(textColor)
         .text('Boda Suite', 50, 80, { align: 'center' })
      
      // Línea separadora
      doc.moveTo(50, 110)
         .lineTo(550, 110)
         .strokeColor(primaryColor)
         .lineWidth(2)
         .stroke()
      
      // Información de la boda
      let yPosition = 140
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('INFORMACIÓN DE LA BODA', 50, yPosition)
      
      yPosition += 25
      doc.fontSize(11)
         .fillColor(textColor)
         .text(`Novios: ${configuracionData.nombre_novio} & ${configuracionData.nombre_novia}`, 50, yPosition)
      
      yPosition += 15
      doc.text(`Fecha: ${new Date(configuracionData.fecha_boda).toLocaleDateString('es-ES')}`, 50, yPosition)
      
      yPosition += 15
      doc.text(`Hora: ${configuracionData.hora_boda}`, 50, yPosition)
      
      yPosition += 15
      doc.text(`Lugar: ${configuracionData.lugar_boda}`, 50, yPosition)
      
      // Información del hotel
      yPosition += 35
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('INFORMACIÓN DEL HOTEL', 50, yPosition)
      
      yPosition += 25
      doc.fontSize(11)
         .fillColor(textColor)
         .text(`Hotel: ${hotelData.nombre}`, 50, yPosition)
      
      yPosition += 15
      doc.text(`Dirección: ${hotelData.direccion}`, 50, yPosition)
      
      if (hotelData.servicios_incluidos) {
        yPosition += 15
        let servicios = hotelData.servicios_incluidos
        
        // Si es un string JSON, parsearlo
        if (typeof servicios === 'string') {
          try {
            servicios = JSON.parse(servicios)
          } catch (e) {
            servicios = [servicios] // Si no es JSON válido, tratarlo como string simple
          }
        }
        
        // Asegurar que sea un array
        if (Array.isArray(servicios) && servicios.length > 0) {
          doc.text(`Servicios: ${servicios.join(', ')}`, 50, yPosition)
        } else if (typeof servicios === 'string' && servicios.trim()) {
          doc.text(`Servicios: ${servicios}`, 50, yPosition)
        }
      }
      
      // Información del invitado
      yPosition += 35
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('INFORMACIÓN DEL INVITADO', 50, yPosition)
      
      yPosition += 25
      doc.fontSize(11)
         .fillColor(textColor)
         .text(`Nombre: ${invitadoData.nombre}`, 50, yPosition)
      
      yPosition += 15
      doc.text(`Email: ${invitadoData.email}`, 50, yPosition)
      
      yPosition += 15
      doc.text(`Teléfono: ${invitadoData.telefono}`, 50, yPosition)
      
      if (invitadoData.habitacion_nombre) {
        yPosition += 15
        doc.text(`Habitación: ${invitadoData.habitacion_nombre}`, 50, yPosition)
      }
      
      // Detalles del pago
      yPosition += 35
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('DETALLES DEL PAGO', 50, yPosition)
      
      yPosition += 25
      doc.fontSize(11)
         .fillColor(textColor)
         .text(`Fecha de Pago: ${new Date(pagoData.fecha_pago).toLocaleDateString('es-ES')}`, 50, yPosition)
      
      yPosition += 15
      doc.text(`Método de Pago: ${pagoData.metodo_pago}`, 50, yPosition)
      
      yPosition += 15
      doc.fontSize(12)
         .fillColor(primaryColor)
         .text(`Monto Pagado: $${pagoData.monto.toLocaleString('es-ES')}`, 50, yPosition)
      
      yPosition += 15
      doc.fillColor(textColor)
         .text(`Saldo Pendiente: $${invitadoData.saldo_pendiente.toLocaleString('es-ES')}`, 50, yPosition)
      
      // Cuadro de resumen
      yPosition += 35
      doc.rect(50, yPosition, 500, 80)
         .strokeColor(primaryColor)
         .lineWidth(1)
         .stroke()
      
      doc.fontSize(12)
         .fillColor(primaryColor)
         .text('RESUMEN FINANCIERO', 60, yPosition + 10)
      
      doc.fontSize(10)
         .fillColor(textColor)
         .text(`Total a Pagar: $${invitadoData.total_a_pagar.toLocaleString('es-ES')}`, 60, yPosition + 30)
         .text(`Total Pagado: $${invitadoData.total_pagado.toLocaleString('es-ES')}`, 60, yPosition + 45)
         .text(`Saldo Pendiente: $${invitadoData.saldo_pendiente.toLocaleString('es-ES')}`, 60, yPosition + 60)
      
      // Pie de página
      yPosition += 120
      doc.fontSize(8)
         .fillColor('#666666')
         .text(`Recibo generado el ${new Date().toLocaleString('es-ES')}`, 50, yPosition, { align: 'center' })
         .text('Este documento es un comprobante oficial de pago', 50, yPosition + 15, { align: 'center' })
      
      // Finalizar documento
      doc.end()
      
      stream.on('finish', () => {
        resolve({
          fileName,
          filePath,
          relativePath: `/recibos/${fileName}`
        })
      })
      
      stream.on('error', (error) => {
        reject(error)
      })
      
    } catch (error) {
      reject(error)
    }
  })
}

export const getReciboPath = (fileName) => {
  return path.join(recibosDir, fileName)
}