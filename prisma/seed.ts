import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando semilla de datos multi-tenant...');

  // Limpiar datos existentes (opcional, útil en desarrollo)
  await prisma.budgetItem.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.clinicalNote.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();

  // ---------------------------------------------------------
  // USUARIO 1: Dra. Bina
  // ---------------------------------------------------------
  const drBina = await prisma.user.create({
    data: {
      email: 'bina@clinicabina.com',
      name: 'Dra. Bina',
    },
  });

  // Pacientes exclusivos de la Dra. Bina
  const elena = await prisma.patient.create({
    data: {
      userId: drBina.id,
      firstName: 'Elena',
      lastName: 'Rodriguez',
      documentId: '44291000',
      phone: '+5491100000001',
      email: 'elena@example.com',
      bloodType: 'A+',
      allergies: 'Penicilina',
      birthDate: new Date('1990-05-15'),
    },
  });

  const marcus = await prisma.patient.create({
    data: {
      userId: drBina.id,
      firstName: 'Marcus',
      lastName: 'Chen',
      documentId: '44302000',
      phone: '+5491100000002',
    },
  });

  // Citas para Dra. Bina
  await prisma.appointment.create({
    data: {
      userId: drBina.id,
      patientId: elena.id,
      date: new Date(),
      startTime: '09:00',
      endTime: '09:45',
      status: 'In Progress',
      notes: 'Control Invisalign',
    },
  });

  await prisma.appointment.create({
    data: {
      userId: drBina.id,
      patientId: marcus.id,
      date: new Date(),
      startTime: '10:30',
      endTime: '11:00',
      status: 'Scheduled',
      notes: 'Limpieza de Rutina',
    },
  });

  // Presupuesto para Dra. Bina -> Elena
  await prisma.budget.create({
    data: {
      userId: drBina.id,
      patientId: elena.id,
      totalAmount: 150000,
      discount: 10000,
      items: {
        create: [
          { description: 'Control Invisalign', quantity: 1, value: 50000 },
          { description: 'Alineadores Set 2', quantity: 1, value: 110000 },
        ],
      },
    },
  });

  // Notas clínicas para Dra. Bina -> Elena
  await prisma.clinicalNote.create({
    data: {
      userId: drBina.id,
      patientId: elena.id,
      toothId: '16',
      description: 'Resina compuesta en superficie oclusal. Sin complicaciones.',
      date: new Date('2024-03-12'),
    },
  });


  // ---------------------------------------------------------
  // USUARIO 2: Dr. Smith (OTRO DOCTOR, DATOS AISLADOS)
  // ---------------------------------------------------------
  const drSmith = await prisma.user.create({
    data: {
      email: 'smith@otra-clinica.com',
      name: 'Dr. John Smith',
    },
  });

  // Pacientes exclusivos del Dr. Smith
  const laura = await prisma.patient.create({
    data: {
      userId: drSmith.id,
      firstName: 'Laura',
      lastName: 'Gomez',
      documentId: '35111222',
      phone: '+5491133334444',
    },
  });

  // Cita para Dr. Smith (nunca debe mezclarse con las de Bina)
  await prisma.appointment.create({
    data: {
      userId: drSmith.id,
      patientId: laura.id,
      date: new Date(),
      startTime: '14:00',
      endTime: '15:00',
      status: 'Scheduled',
      notes: 'Consulta Inicial Ortodoncia',
    },
  });

  console.log('✅ Base de datos poblada exitosamente.');
  console.log(`- Creado Usuario 1: ${drBina.name} (${drBina.email}) con 2 pacientes.`);
  console.log(`- Creado Usuario 2: ${drSmith.name} (${drSmith.email}) con 1 paciente.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
