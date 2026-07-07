import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { createClient } from '@/utils/supabase/client';

const getBankDetails = async () => {
  const supabase = createClient();
  const { data } = await supabase.from('clinic_settings').select('value').eq('key', 'bank_details').single();
  if (data && data.value) return data.value;
  return {
    beneficiary: "Titular de la Cuenta",
    bank: "Banco",
    cbu: "0000000000000000000000",
    alias: "clinica.dental.alias",
    cuit: "00-00000000-0"
  };
};

export const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
};

export const generateBudgetPDF = async (budget: any, patient: any) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const bankDetails: any = await getBankDetails();
  
  // Colors
  const primaryColor = '#8c7362'; // Brownish color from screenshot
  const textColor = '#333333';
  const labelColor = '#9a8c82';

  // Fonts & Setup
  doc.setFont('helvetica');
  
  // Left beige border
  doc.setFillColor(246, 240, 234);
  doc.rect(0, 0, 12, 297, 'F'); // A4 height is 297mm

  // Load and Add Logo
  try {
    const logoImg = await loadImage('/images/logo_b.png');
    doc.addImage(logoImg, 'PNG', 15, 12, 20, 24);
  } catch (err) {
    console.error("Failed to load logo", err);
  }

  // Title Box
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(45, 20, 145, 10, 5, 5, 'S');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PRESUPUESTO TRATAMIENTO ODONTOLÓGICO', 117.5, 26.5, { align: 'center' });

  // Patient & Date Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.setTextColor(labelColor);
  doc.text('Paciente:', 20, 45);
  doc.setTextColor(textColor);
  doc.text(`${patient.first_name} ${patient.last_name}`, 40, 45);
  
  doc.setTextColor(labelColor);
  doc.text('Fecha:', 20, 55);
  doc.setTextColor(textColor);
  doc.text(format(parseISO(budget.created_at || new Date().toISOString()), "d 'de' MMMM, yyyy", { locale: es }), 40, 55);

  // Items Table
  const tableData = budget.items.map((item: any) => [
    item.description,
    '1',
    `$${Number(item.value).toLocaleString('es-AR')}`
  ]);

  autoTable(doc, {
    startY: 65,
    head: [['Descripción', 'Cantidad', 'Valor']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: false,
      textColor: 0,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 100 },
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'center', cellWidth: 40 }
    },
    bodyStyles: {
      textColor: 0,
    },
    willDrawCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) {
        // Draw rounded box for header
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.5);
        doc.roundedRect(data.cell.x, data.cell.y - 2, 170, 8, 4, 4, 'S');
      }
      if (data.section === 'body') {
        // Draw bottom border for each cell
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.2);
        doc.line(
          data.cell.x, 
          data.cell.y + data.cell.height, 
          data.cell.x + data.cell.width, 
          data.cell.y + data.cell.height
        );
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  // Subtotals (Right side)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 140, finalY);
  doc.text('Impuestos:', 140, finalY + 8);
  doc.text('Descuento:', 140, finalY + 16);

  // Total Box (Right side)
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(130, finalY + 22, 60, 10, 5, 5, 'S');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total:  $${Number(budget.total_amount).toLocaleString('es-AR')}`, 160, finalY + 28.5, { align: 'center' });

  // Terms and Conditions (Left side)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Términos y Condiciones:', 20, finalY);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('El presente presupuesto tendrá vigencia de 20', 20, finalY + 6);
  doc.text('días a partir de la fecha de emisión para su', 20, finalY + 11);
  doc.text('aceptación.', 20, finalY + 16);
  
  doc.text('Los valores indicados quedan sujeto a', 20, finalY + 21);
  doc.setFont('helvetica', 'bold');
  doc.text('modificaciones en etapas de tratamiento no', 20, finalY + 26);
  doc.text('iniciadas.', 20, finalY + 31);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Se solicitará una seña del 50%, para comenzar', 20, finalY + 36);
  doc.text('el tratamiento debiendo abonarse el saldo total', 20, finalY + 41);
  doc.setFont('helvetica', 'bold');
  doc.text('al finalizar cada etapa del mismo.', 20, finalY + 46);

  if (budget.observations) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(primaryColor);
    doc.setFontSize(8);
    const splitObs = doc.splitTextToSize(`Observaciones: ${budget.observations}`, 100);
    doc.text(splitObs, 20, finalY + 52);
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#888888');
  doc.text('DOCUMENTO NO VÁLIDO COMO FACTURA', 20, finalY + (budget.observations ? 62 : 54));

  // Footer Details (Payment & Contact)
  const footerY = finalY + 70;
  
  // Background for footer
  doc.setFillColor(249, 249, 249);
  doc.rect(0, footerY - 5, 210, 50, 'F');

  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Información de Pago', 20, footerY);
  
  doc.setFontSize(9);
  doc.setTextColor(labelColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Nombre del Beneficiario:', 20, footerY + 6);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.text(bankDetails.beneficiary, 63, footerY + 6);

  doc.setTextColor(labelColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Banco:', 20, footerY + 11);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.text(bankDetails.bank, 33, footerY + 11);

  doc.setTextColor(labelColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Número de Cuenta:', 20, footerY + 16);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.text(bankDetails.cbu, 53, footerY + 16);

  doc.setTextColor(labelColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Alias:', 20, footerY + 21);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(bankDetails.alias, 30, footerY + 21);

  doc.setTextColor(labelColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Cuit/Cuil:', 20, footerY + 26);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.text('23-40691887-4', 36, footerY + 26);

  // Contact Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Datos de Contacto', 130, footerY);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Tucumán 452, Paraná ER', 130, footerY + 6);
  doc.text('343- 4571176', 130, footerY + 11);
  doc.text('odontologiaparados@gmail.com', 130, footerY + 16);

  // Save the PDF
  const filename = `Presupuesto_${patient.last_name}_${format(new Date(), 'dd-MM-yyyy')}.pdf`;
  window.open(doc.output('bloburl'), '_blank');
};

export const generatePaymentPDF = (payment: any, budget: any, patient: any) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const primaryColor = '#8c7362'; 
  const labelColor = '#9a8c82';
  const textColor = '#333333';

  doc.setDrawColor(primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(60, 20, 130, 10, 5, 5, 'S');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE DE PAGO / SEÑA', 125, 26.5, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.setTextColor(labelColor);
  doc.text('Paciente:', 20, 45);
  doc.setTextColor(textColor);
  doc.text(`${patient.first_name} ${patient.last_name}`, 40, 45);
  
  doc.setTextColor(labelColor);
  doc.text('Fecha:', 20, 55);
  doc.setTextColor(textColor);
  doc.text(format(parseISO(payment.date), "d 'de' MMMM, yyyy", { locale: es }), 40, 55);

  const tableData = [
    ['Pago a cuenta de presupuesto', payment.method, `$${Number(payment.amount).toLocaleString('es-AR')}`]
  ];

  autoTable(doc, {
    startY: 65,
    head: [['Descripción', 'Método', 'Monto']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: false,
      textColor: 0,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 100 },
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'center', cellWidth: 40 }
    },
    willDrawCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) {
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.5);
        doc.roundedRect(data.cell.x, data.cell.y - 2, 170, 8, 4, 4, 'S');
      }
      if (data.section === 'body') {
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.2);
        doc.line(
          data.cell.x, 
          data.cell.y + data.cell.height, 
          data.cell.x + data.cell.width, 
          data.cell.y + data.cell.height
        );
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#888888');
  doc.text('DOCUMENTO NO VÁLIDO COMO FACTURA', 20, finalY);

  const filename = `Comprobante_${patient.last_name}_${format(new Date(), 'dd-MM-yyyy')}.pdf`;
  window.open(doc.output('bloburl'), '_blank');
};

export const generateBillPDF = async (bill: any, patient: any) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const billTotalPaid = bill.payments ? bill.payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0) : 0;
  const balance = Number(bill.total_amount) - billTotalPaid;
  const isFullyPaid = balance <= 0;

  const accentColor = isFullyPaid ? '#15803d' : '#b45309'; // Green if paid, Orange if pending
  const labelColor = '#6b7280';
  const textColor = '#111827';
  
  try {
    const logoIcon = await loadImage('/images/logo_b.png');
    // Draw the icon logo
    doc.addImage(logoIcon, 'PNG', 20, 15, 25, 25);
  } catch (e) {
    console.error("No se pudo cargar el logo", e);
  }

  doc.setDrawColor(accentColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(60, 18, 130, 12, 5, 5, 'S');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentColor);
  doc.text(isFullyPaid ? 'TICKET DE PAGO ABONADO' : 'TICKET DE PAGO PENDIENTE', 125, 26, { align: 'center' });

  // Patient Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(labelColor);
  doc.text('Paciente:', 20, 50);
  doc.setTextColor(textColor);
  doc.text(`${patient.first_name} ${patient.last_name}`, 40, 50);

  doc.setTextColor(labelColor);
  doc.text('Fecha:', 20, 57);
  doc.setTextColor(textColor);
  doc.text(format(parseISO(bill.created_at), "d 'de' MMMM, yyyy", { locale: es }), 40, 57);

  doc.setTextColor(labelColor);
  doc.text('ID Ticket:', 140, 50);
  doc.setTextColor(textColor);
  doc.text(`#${bill.id.split('-')[0].toUpperCase()}`, 160, 50);

  const tableData = bill.items.map((item: any) => [
    item.description,
    `$${Number(item.value).toLocaleString('es-AR')}`
  ]);

  autoTable(doc, {
    startY: 70,
    head: [['Detalle de Práctica', 'Valor']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: false,
      textColor: 0,
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 130 },
      1: { halign: 'right', cellWidth: 40 }
    },
    willDrawCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) {
        doc.setDrawColor(accentColor);
        doc.setLineWidth(0.5);
        doc.roundedRect(data.cell.x, data.cell.y - 2, 170, 8, 4, 4, 'S');
      }
      if (data.section === 'body') {
        doc.setDrawColor('#e5e7eb');
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(labelColor);
  doc.text('Monto Total:', 120, finalY);
  doc.text('Abonado:', 120, finalY + 8);
  doc.setFont('helvetica', 'bold');
  doc.text('Saldo Restante:', 120, finalY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor);
  doc.text(`$${Number(bill.total_amount).toLocaleString('es-AR')}`, 190, finalY, { align: 'right' });
  doc.setTextColor('#15803d');
  doc.text(`$${billTotalPaid.toLocaleString('es-AR')}`, 190, finalY + 8, { align: 'right' });
  doc.setTextColor(accentColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`$${balance.toLocaleString('es-AR')}`, 190, finalY + 16, { align: 'right' });

  // Big Watermark for Paid
  if (isFullyPaid) {
    doc.setTextColor(220, 252, 231); // Very light green
    doc.setFontSize(50);
    doc.text('PAGADO', 105, finalY + 40, { align: 'center', angle: -20 });
  } else {
    doc.setTextColor(255, 237, 213); // Very light orange
    doc.setFontSize(50);
    doc.text('PENDIENTE', 105, finalY + 40, { align: 'center', angle: -20 });
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#888888');
  doc.text('DOCUMENTO NO VÁLIDO COMO FACTURA', 20, finalY + 60);

  window.open(doc.output('bloburl'), '_blank');
};
