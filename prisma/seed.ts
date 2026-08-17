import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const biodiversidadText =
  'La biodiversidad es el conjunto de formas de vida que habitan nuestro planeta. Cada ecosistema alberga especies que dependen entre sí para sobrevivir. Cuando una especie desaparece, las consecuencias se propagan en cadena hacia el resto del sistema. Proteger la biodiversidad no es solo una cuestión ambiental, sino también cultural y económica.';

async function main() {
  await prisma.$transaction([
    prisma.answer.deleteMany(),
    prisma.studentResult.deleteMany(),
    prisma.response.deleteMany(),
    prisma.question.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.performanceAlert.deleteMany(),
    prisma.auditLogEntry.deleteMany(),
    prisma.consentAcceptance.deleteMany(),
    prisma.student.deleteMany(),
    prisma.course.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.oAuthIntegration.deleteMany(),
    prisma.user.deleteMany(),
    prisma.institutionLevel.deleteMany(),
    prisma.institution.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.consentDocument.deleteMany(),
    prisma.monitoringComponent.deleteMany(),
    prisma.incident.deleteMany(),
  ]);

  const belgranoNorte = await prisma.institution.create({
    data: {
      slug: 'belgrano-norte',
      name: 'Colegio Belgrano Norte',
      domain: 'colegiobelgranonorte.edu.ar',
      status: 'ACTIVO',
      coordinatorEmail: 'coordinacion@colegiobelgranonorte.edu.ar',
      levels: { create: [{ level: 'PRIMARIO' }, { level: 'SECUNDARIO' }] },
    },
  });

  const sanMartin = await prisma.institution.create({
    data: {
      slug: 'san-martin',
      name: 'Instituto San Martín',
      domain: 'institutosanmartin.edu.ar',
      status: 'ACTIVO',
      coordinatorEmail: 'coordinacion@institutosanmartin.edu.ar',
      levels: { create: [{ level: 'SECUNDARIO' }] },
    },
  });

  const teacherLopez = await prisma.user.create({
    data: {
      name: 'López, Paula',
      initials: 'LP',
      email: 'paula.lopez@colegiobelgranonorte.edu.ar',
      role: 'DOCENTE',
      provider: 'GOOGLE',
      institutionId: belgranoNorte.id,
    },
  });

  const coordinatorMartinez = await prisma.user.create({
    data: {
      name: 'Martínez, Carla',
      initials: 'MC',
      email: 'coordinacion@colegiobelgranonorte.edu.ar',
      role: 'COORDINADOR',
      provider: 'MICROSOFT',
      institutionId: belgranoNorte.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Admin Habitar',
      initials: 'AH',
      email: 'plataforma@habitar.com.ar',
      role: 'ADMIN',
      provider: 'GOOGLE',
      institutionId: belgranoNorte.id,
    },
  });

  const teacherGarcia = await prisma.user.create({
    data: {
      name: 'García, M.',
      initials: 'GM',
      email: 'm.garcia@colegiobelgranonorte.edu.ar',
      role: 'DOCENTE',
      provider: 'MICROSOFT',
      institutionId: belgranoNorte.id,
    },
  });

  const teacherRuiz = await prisma.user.create({
    data: {
      name: 'Ruiz, T.',
      initials: 'RT',
      email: 't.ruiz@colegiobelgranonorte.edu.ar',
      role: 'DOCENTE',
      provider: 'MICROSOFT',
      institutionId: belgranoNorte.id,
    },
  });

  const teacherMolina = await prisma.user.create({
    data: {
      name: 'Molina, S.',
      initials: 'MS',
      email: 's.molina@colegiobelgranonorte.edu.ar',
      role: 'DOCENTE',
      provider: 'MICROSOFT',
      institutionId: belgranoNorte.id,
    },
  });

  const course4b = await prisma.course.create({
    data: { name: '4°B', subject: 'Lengua y Literatura', institutionId: belgranoNorte.id, teacherId: teacherLopez.id },
  });
  await prisma.course.create({
    data: { name: '4°A', subject: 'Lengua y Literatura', institutionId: belgranoNorte.id, teacherId: teacherLopez.id },
  });
  const course5a = await prisma.course.create({
    data: { name: '5°A', subject: 'Lengua y Literatura', institutionId: belgranoNorte.id, teacherId: teacherGarcia.id },
  });
  await prisma.course.create({
    data: { name: '5°B', subject: 'Lengua y Literatura', institutionId: belgranoNorte.id, teacherId: teacherLopez.id },
  });
  const course3c = await prisma.course.create({
    data: { name: '3°C', subject: 'Lengua y Literatura', institutionId: belgranoNorte.id, teacherId: teacherRuiz.id },
  });
  await prisma.course.create({
    data: { name: '6°B', subject: 'Lengua y Literatura', institutionId: belgranoNorte.id, teacherId: teacherMolina.id },
  });

  const students4b = await Promise.all(
    [
      { name: 'García, Valentina', initials: 'GV' },
      { name: 'López, Marcos', initials: 'LM' },
      { name: 'Rodríguez, Sofía', initials: 'RS' },
      { name: 'Torres, Emiliano', initials: 'ET' },
      { name: 'Fernández, Lucía', initials: 'FL' },
    ].map((student) => prisma.student.create({ data: { ...student, courseId: course4b.id } })),
  );

  const activity = await prisma.activity.create({
    data: {
      code: 'HAB-4B29',
      name: 'Comprensión lectora — Biodiversidad',
      educationLevel: 'Secundario — 4°',
      axis: 'INFERENCIAL',
      sourceText: biodiversidadText,
      availableFrom: '2026-06-18',
      startTime: '08:00',
      endTime: '12:00',
      attemptPolicy: 'UNICO',
      status: 'PUBLICADA',
      courseId: course4b.id,
      questions: {
        create: [
          {
            axis: 'LITERAL',
            prompt: '¿Qué es la biodiversidad según el texto?',
            expectedAnswer: 'El conjunto de formas de vida que habitan el planeta',
            optionsJson: JSON.stringify([
              'El conjunto de formas de vida del planeta',
              'La cantidad de ecosistemas',
              'Solo los animales en peligro',
            ]),
            correctOption: 'El conjunto de formas de vida del planeta',
            approved: true,
            order: 0,
          },
          {
            axis: 'INFERENCIAL',
            prompt: '¿Por qué la desaparición de una especie afecta a otras del mismo ecosistema?',
            expectedAnswer: 'Porque las especies dependen entre sí, generando efectos en cadena',
            optionsJson: JSON.stringify([
              'Porque las especies dependen entre sí y se generan efectos en cadena',
              'Porque cada especie vive de forma aislada',
              'Porque solo afecta a especies de la misma familia',
            ]),
            correctOption: 'Porque las especies dependen entre sí y se generan efectos en cadena',
            edited: true,
            approved: true,
            order: 1,
          },
          {
            axis: 'CRITICO',
            prompt: '¿Estás de acuerdo con que proteger la biodiversidad es responsabilidad de todos? Justificá.',
            expectedAnswer: '(respuesta abierta — justificación con argumentos del texto)',
            approved: false,
            order: 2,
          },
          {
            axis: 'INFERENCIAL',
            prompt: '¿Qué relación establece el texto entre biodiversidad y economía?',
            expectedAnswer: 'La protección de la biodiversidad tiene también una dimensión económica, no solo ambiental',
            optionsJson: JSON.stringify([
              'Es también una cuestión económica, no solo ambiental',
              'No existe ninguna relación',
              'La economía depende únicamente del turismo',
            ]),
            correctOption: 'Es también una cuestión económica, no solo ambiental',
            approved: false,
            order: 3,
          },
          {
            axis: 'INFERENCIAL',
            prompt: '¿Qué consecuencia tendría ignorar la interdependencia entre especies de un ecosistema?',
            expectedAnswer: 'Se propagarían efectos en cadena que podrían colapsar el equilibrio del ecosistema',
            optionsJson: JSON.stringify([
              'Se propagarían efectos en cadena que afectan al ecosistema completo',
              'No tendría ninguna consecuencia',
              'Solo afectaría a la especie que desaparece',
            ]),
            correctOption: 'Se propagarían efectos en cadena que afectan al ecosistema completo',
            approved: true,
            order: 4,
          },
        ],
      },
    },
  });

  const historicalScores: Record<string, { literal: number; inferencial: number; critico: number }> = {
    'García, Valentina': { literal: 85, inferencial: 74, critico: 62 },
    'López, Marcos': { literal: 70, inferencial: 55, critico: 38 },
    'Rodríguez, Sofía': { literal: 90, inferencial: 80, critico: 70 },
    'Torres, Emiliano': { literal: 45, inferencial: 30, critico: 20 },
  };

  for (const student of students4b) {
    const scores = historicalScores[student.name];
    if (!scores) continue;

    const response = await prisma.response.create({
      data: {
        activityId: activity.id,
        studentId: student.id,
        studentDisplayName: student.name,
      },
    });

    await prisma.studentResult.create({
      data: {
        studentId: student.id,
        activityId: activity.id,
        responseId: response.id,
        literalScore: scores.literal,
        inferencialScore: scores.inferencial,
        criticoScore: scores.critico,
      },
    });
  }

  await prisma.performanceAlert.create({
    data: {
      courseId: course3c.id,
      axis: 'CRITICO',
      currentValue: 21,
      threshold: 40,
      severity: 'CRITICA',
      detectedAt: '2026-06-17',
      message: 'Comprensión crítica bajo umbral',
    },
  });

  await prisma.performanceAlert.create({
    data: {
      courseId: course4b.id,
      axis: 'INFERENCIAL',
      currentValue: 58,
      threshold: 60,
      severity: 'ADVERTENCIA',
      detectedAt: '2026-06-18',
      message: 'Comprensión inferencial en descenso',
    },
  });

  await prisma.performanceAlert.create({
    data: {
      courseId: course5a.id,
      axis: 'CRITICO',
      currentValue: 65,
      threshold: 60,
      severity: 'RESUELTA',
      detectedAt: '2026-06-15',
      message: 'Recuperación sostenida — todos los ejes superan el umbral por segunda semana consecutiva',
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      studentId: students4b[0].id,
      studentName: 'García, V.',
      operation: 'EXPORTACION',
      performedBy: 'coord.martinez',
      performedById: coordinatorMartinez.id,
      date: new Date('2026-06-10'),
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      studentId: null,
      studentName: 'López, M.',
      operation: 'ELIMINACION',
      performedBy: 'coord.martinez',
      performedById: coordinatorMartinez.id,
      date: new Date('2026-05-02'),
    },
  });

  await prisma.consentDocument.create({
    data: {
      version: '1.2',
      publishedAt: '2026-06-01',
      dataController: 'Colegio Belgrano Norte',
      dataProcessor: 'Habitar (Operador)',
    },
  });

  const planEstandar = await prisma.plan.create({ data: { name: 'Estándar', monthlyPriceArs: 150000 } });
  await prisma.plan.create({ data: { name: 'Premium', monthlyPriceArs: 220000 } });

  await prisma.subscription.create({
    data: {
      institutionId: belgranoNorte.id,
      planId: planEstandar.id,
      monthlyPriceArs: 130000,
      expiresAt: '2026-06-30',
      managementStatus: 'EN_NEGOCIACION',
      durationMonths: 12,
    },
  });

  await prisma.subscription.create({
    data: {
      institutionId: sanMartin.id,
      planId: planEstandar.id,
      monthlyPriceArs: 130000,
      expiresAt: '2026-08-15',
      managementStatus: 'EN_NEGOCIACION',
      durationMonths: 12,
    },
  });

  await prisma.oAuthIntegration.create({
    data: {
      institutionId: belgranoNorte.id,
      provider: 'GOOGLE',
      clientId: 'habitar_belgrano_norte_20260601',
      currentStepIndex: 1,
    },
  });

  await prisma.monitoringComponent.createMany({
    data: [
      { name: 'API Backend (AWS ECS)', health: 'OPERATIVO', uptimePercent: 99.7 },
      { name: 'Base de datos PostgreSQL (RDS)', health: 'OPERATIVO', uptimePercent: 100 },
      { name: 'API OpenAI (GPT-4o)', health: 'OPERATIVO', uptimePercent: 98.5 },
      { name: 'Auth OAuth (Google/Microsoft)', health: 'DEGRADADO', uptimePercent: 95 },
    ],
  });

  await prisma.incident.createMany({
    data: [
      { date: '12 jun · 03:14', component: 'API Backend', duration: '8 min', status: 'RESUELTO' },
      { date: 'Mantenimiento programado · 04:00–04:30', component: 'Todos', duration: '30 min', status: 'PLANIFICADO' },
    ],
  });

  console.log('Seed completado');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
