"use strict";
/**
 * reportService — Reporte de impacto semestral por entidad (§5).
 *   · construirResumen(): funcion PURA (testeable) que arma el objeto resumen.
 *   · generarPDF(): renderiza el resumen a un stream PDF (usa pdfkit, carga lazy).
 */
const reputation = require("./reputationService");

/**
 * @param {{id,nombre,tipo}} entidad
 * @param {Array} actividades  (con estado, fecha_inicio, created_at, alcance_estimado, compatibilidad_pct)
 * @param {{anio,semestre}|null} periodo
 */
function construirResumen(entidad, actividades = [], periodo = null) {
  const rep = reputation.calcular(actividades);
  const realizadas = actividades.filter((a) => a.estado === "REALIZADA").length;
  const reprogramadas = actividades.filter((a) => a.estado === "SUSPENDIDA" || a.estado === "REPROGRAMADA").length;
  const alcanceTotal = actividades.reduce((s, a) => s + (a.alcance_estimado || 0), 0);

  return {
    entidad: { id: entidad.id, nombre: entidad.nombre, tipo: entidad.tipo },
    periodo: periodo ? { anio: periodo.anio, semestre: periodo.semestre } : null,
    generadoEn: new Date().toISOString(),
    totales: { total: actividades.length, realizadas, reprogramadas, alcanceTotal },
    reputacion: rep.reputacion,
    confiabilidad_pct: rep.confiabilidad_pct,
    sello_coordinacion: rep.sello_coordinacion,
    actividades: actividades.map((a) => ({
      titulo: a.titulo,
      fecha: a.fecha_inicio,
      estado: a.estado,
      alcance: a.alcance_estimado || 0,
      compatibilidad: a.compatibilidad_pct,
    })),
  };
}

/** Renderiza el resumen como PDF y lo escribe en `stream` (res). */
function generarPDF(resumen, stream) {
  const PDFDocument = require("pdfkit"); // lazy: no requerido en tests de resumen
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(stream);

  doc.fontSize(20).fillColor("#2563EB").text("MapFI - Reporte de Impacto");
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor("#64748B").text(resumen.entidad.nombre);
  if (resumen.periodo) doc.text(`Periodo: ${resumen.periodo.anio} - Semestre ${resumen.periodo.semestre}`);
  doc.text(`Generado: ${new Date(resumen.generadoEn).toLocaleString("es-CL")}`);
  doc.moveDown();

  doc.fillColor("#0F172A").fontSize(14).text("Resumen");
  doc.moveDown(0.2);
  doc.fontSize(11);
  const t = resumen.totales;
  doc.text(`Actividades totales: ${t.total}`);
  doc.text(`Realizadas: ${t.realizadas}`);
  doc.text(`Suspendidas / reprogramadas: ${t.reprogramadas}`);
  doc.text(`Alcance total estimado: ${t.alcanceTotal} estudiantes`);
  doc.text(`Reputacion: ${resumen.reputacion}`);
  doc.text(`Confiabilidad: ${resumen.confiabilidad_pct}%`);
  doc.text(`Sello de coordinacion eficiente: ${resumen.sello_coordinacion ? "SI" : "No"}`);
  doc.moveDown();

  doc.fontSize(14).text("Detalle de actividades");
  doc.moveDown(0.2);
  doc.fontSize(10);
  if (!resumen.actividades.length) {
    doc.fillColor("#64748B").text("Sin actividades en el periodo.");
  } else {
    resumen.actividades.forEach((a) => {
      const fecha = a.fecha ? new Date(a.fecha).toLocaleDateString("es-CL") : "-";
      doc.fillColor("#0F172A").text(`- ${fecha}  ${a.titulo}  [${a.estado}]  alcance ${a.alcance}`);
    });
  }

  doc.end();
}

module.exports = { construirResumen, generarPDF };
