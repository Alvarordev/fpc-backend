import { EducationLevel } from '../../../patients/entities/education-level.enum';
import { CancerStage } from '../../../patients/entities/patient-diagnosis.entity';
import type { PeruDepartment } from '../../entities/health-center.entity';

/**
 * Fixed reference data for the demo seed. Everything here is hand-written so
 * the generated dataset reads like real Peruvian oncology casework rather than
 * like `test-user-1`.
 */

export interface HealthCenterSeed {
  name: string;
  slug: string;
  department: PeruDepartment;
  isActive?: boolean;
}

export const HEALTH_CENTERS: readonly HealthCenterSeed[] = [
  // Lima — the referral hubs most patients end up at.
  {
    name: 'Instituto Nacional de Enfermedades Neoplásicas (INEN)',
    slug: 'inen-lima',
    department: 'LIMA',
  },
  {
    name: 'Hospital Nacional Edgardo Rebagliati Martins',
    slug: 'rebagliati-lima',
    department: 'LIMA',
  },
  {
    name: 'Hospital Nacional Guillermo Almenara Irigoyen',
    slug: 'almenara-lima',
    department: 'LIMA',
  },
  {
    name: 'Hospital Nacional Arzobispo Loayza',
    slug: 'loayza-lima',
    department: 'LIMA',
  },
  {
    name: 'Hospital Nacional Dos de Mayo',
    slug: 'dos-de-mayo-lima',
    department: 'LIMA',
  },
  {
    name: 'Instituto Nacional de Salud del Niño San Borja',
    slug: 'insn-san-borja-lima',
    department: 'LIMA',
  },
  {
    name: 'Hospital Nacional Alberto Sabogal Sologuren',
    slug: 'sabogal-callao',
    department: 'CALLAO',
  },
  {
    name: 'Hospital Nacional Daniel Alcides Carrión',
    slug: 'carrion-callao',
    department: 'CALLAO',
  },
  // Regional centers — the reason patients report long travel times.
  {
    name: 'Instituto Regional de Enfermedades Neoplásicas del Sur',
    slug: 'iren-sur-arequipa',
    department: 'AREQUIPA',
  },
  {
    name: 'Hospital Goyeneche',
    slug: 'goyeneche-arequipa',
    department: 'AREQUIPA',
  },
  {
    name: 'Instituto Regional de Enfermedades Neoplásicas del Norte',
    slug: 'iren-norte-la-libertad',
    department: 'LA_LIBERTAD',
  },
  {
    name: 'Hospital Regional Docente de Trujillo',
    slug: 'regional-trujillo-la-libertad',
    department: 'LA_LIBERTAD',
  },
  {
    name: 'Hospital Regional Lambayeque',
    slug: 'regional-lambayeque',
    department: 'LAMBAYEQUE',
  },
  {
    name: 'Hospital Regional José Cayetano Heredia',
    slug: 'cayetano-heredia-piura',
    department: 'PIURA',
  },
  {
    name: 'Hospital Regional del Cusco',
    slug: 'regional-cusco',
    department: 'CUSCO',
  },
  {
    name: 'Hospital Regional Docente Clínico Quirúrgico Daniel Alcides Carrión',
    slug: 'regional-huancayo-junin',
    department: 'JUNIN',
  },
  {
    name: 'Hospital Víctor Ramos Guardia',
    slug: 'ramos-guardia-ancash',
    department: 'ANCASH',
  },
  {
    name: 'Hospital Regional de Loreto',
    slug: 'regional-loreto',
    department: 'LORETO',
  },
  {
    name: 'Hospital Regional de Ica',
    slug: 'regional-ica',
    department: 'ICA',
    isActive: false,
  },
  {
    name: 'Hospital Regional Manuel Núñez Butrón',
    slug: 'nunez-butron-puno',
    department: 'PUNO',
    isActive: false,
  },
];

export const FIRST_NAMES_FEMALE = [
  'María',
  'Rosa',
  'Carmen',
  'Juana',
  'Luz',
  'Elena',
  'Yolanda',
  'Milagros',
  'Gladys',
  'Nancy',
  'Isabel',
  'Verónica',
  'Rocío',
  'Teresa',
  'Marisol',
] as const;

export const FIRST_NAMES_MALE = [
  'José',
  'Carlos',
  'Luis',
  'Julio',
  'Víctor',
  'Manuel',
  'Pedro',
  'Jorge',
  'Wilfredo',
  'Ricardo',
  'Alberto',
  'Segundo',
  'Máximo',
  'Aurelio',
  'Fernando',
] as const;

export const LAST_NAMES = [
  'Quispe',
  'Mamani',
  'Huamán',
  'Flores',
  'Chávez',
  'Rojas',
  'Vásquez',
  'Sánchez',
  'Ramos',
  'Espinoza',
  'Condori',
  'Ccahuana',
  'Paredes',
  'Salazar',
  'Zevallos',
  'Bautista',
  'Ynga',
  'Tarrillo',
  'Cabrera',
  'Ordoñez',
] as const;

/** Districts keyed by department, so addresses match the patient's region. */
export const DISTRICTS: Record<string, readonly string[]> = {
  LIMA: [
    'San Juan de Lurigancho',
    'Villa El Salvador',
    'Comas',
    'Ate',
    'San Martín de Porres',
    'Villa María del Triunfo',
    'Carabayllo',
  ],
  CALLAO: ['Ventanilla', 'Bellavista', 'Callao Cercado', 'Carmen de la Legua'],
  AREQUIPA: ['Cerro Colorado', 'Paucarpata', 'Cayma', 'Socabaya'],
  LA_LIBERTAD: ['El Porvenir', 'La Esperanza', 'Trujillo', 'Laredo'],
  LAMBAYEQUE: ['José Leonardo Ortiz', 'Chiclayo', 'La Victoria', 'Ferreñafe'],
  PIURA: ['Castilla', 'Veintiséis de Octubre', 'Catacaos', 'Sullana'],
  CUSCO: ['San Sebastián', 'Wanchaq', 'Santiago', 'San Jerónimo'],
  JUNIN: ['El Tambo', 'Chilca', 'Huancayo', 'Concepción'],
  ANCASH: ['Independencia', 'Huaraz', 'Nuevo Chimbote'],
  LORETO: ['Belén', 'Punchana', 'San Juan Bautista'],
  ICA: ['Ica', 'Parcona', 'Chincha Alta'],
  PUNO: ['Juliaca', 'Puno', 'Ilave'],
};

export const STREET_NAMES = [
  'Av. Los Héroes',
  'Jr. Amazonas',
  'Calle Las Begonias',
  'Av. Túpac Amaru',
  'Jr. Ayacucho',
  'Av. Perú',
  'Calle San Martín',
  'Pasaje Los Olivos',
  'Av. Grau',
  'Jr. Junín',
] as const;

export interface DiagnosisSeed {
  diagnosis: string;
  specialty: string;
  symptom: string;
  /** Treatments that plausibly follow this diagnosis. */
  treatments: readonly string[];
}

export const DIAGNOSES: readonly DiagnosisSeed[] = [
  {
    diagnosis: 'Cáncer de mama ductal infiltrante',
    specialty: 'Oncología médica',
    symptom: 'Nódulo palpable en mama izquierda',
    treatments: ['Quimioterapia neoadyuvante', 'Mastectomía', 'Radioterapia'],
  },
  {
    diagnosis: 'Cáncer de cuello uterino',
    specialty: 'Ginecología oncológica',
    symptom: 'Sangrado vaginal intermenstrual',
    treatments: [
      'Quimiorradioterapia',
      'Braquiterapia',
      'Histerectomía radical',
    ],
  },
  {
    diagnosis: 'Cáncer gástrico',
    specialty: 'Oncología quirúrgica',
    symptom: 'Dolor epigástrico persistente y pérdida de peso',
    treatments: ['Gastrectomía subtotal', 'Quimioterapia adyuvante'],
  },
  {
    diagnosis: 'Cáncer de próstata',
    specialty: 'Urología oncológica',
    symptom: 'Dificultad para orinar y nicturia',
    treatments: ['Hormonoterapia', 'Radioterapia externa', 'Prostatectomía'],
  },
  {
    diagnosis: 'Cáncer de colon',
    specialty: 'Oncología quirúrgica',
    symptom: 'Sangrado rectal y cambio del hábito intestinal',
    treatments: ['Hemicolectomía', 'Quimioterapia FOLFOX'],
  },
  {
    diagnosis: 'Linfoma no Hodgkin',
    specialty: 'Hematología',
    symptom: 'Adenopatías cervicales y sudoración nocturna',
    treatments: ['Quimioterapia R-CHOP', 'Terapia de soporte'],
  },
  {
    diagnosis: 'Leucemia mieloide aguda',
    specialty: 'Hematología',
    symptom: 'Fatiga marcada y hematomas espontáneos',
    treatments: ['Quimioterapia de inducción', 'Transfusiones de soporte'],
  },
  {
    diagnosis: 'Cáncer de pulmón no microcítico',
    specialty: 'Oncología médica',
    symptom: 'Tos persistente con hemoptisis',
    treatments: ['Quimioterapia con platino', 'Radioterapia paliativa'],
  },
  {
    diagnosis: 'Cáncer de tiroides papilar',
    specialty: 'Endocrinología oncológica',
    symptom: 'Nódulo tiroideo de crecimiento rápido',
    treatments: ['Tiroidectomía total', 'Yodo radiactivo'],
  },
  {
    diagnosis: 'Cáncer de estómago avanzado',
    specialty: 'Oncología médica',
    symptom: 'Saciedad precoz y vómitos recurrentes',
    treatments: ['Quimioterapia paliativa', 'Manejo del dolor'],
  },
];

export const CANCER_STAGES: readonly CancerStage[] = [
  CancerStage.STAGE_1,
  CancerStage.STAGE_2,
  CancerStage.STAGE_2,
  CancerStage.STAGE_3,
  CancerStage.STAGE_3,
  CancerStage.STAGE_4,
  CancerStage.UNKNOWN,
];

export const TREATMENT_FREQUENCIES = [
  'Cada 21 días',
  'Semanal',
  'Cada 14 días',
  'Diario por 5 semanas',
  'Mensual',
] as const;

export const TREATMENT_SITUATIONS = [
  'EN_CURSO',
  'PENDIENTE_DE_INICIO',
  'INTERRUMPIDO',
  'FINALIZADO',
] as const;

export const MEDICAL_SPECIALTIES = [
  'Oncología médica',
  'Radioterapia',
  'Cirugía oncológica',
  'Nutrición',
  'Psicología',
  'Medicina del dolor',
  'Cardiología',
  'Gastroenterología',
] as const;

export const TRAVEL_TIMES = [
  'Menos de 30 minutos',
  'Entre 30 minutos y 1 hora',
  'Entre 1 y 3 horas',
  'Más de 3 horas',
  'Más de un día de viaje',
] as const;

export const EDUCATION_LEVELS: readonly EducationLevel[] = [
  EducationLevel.PRIMARY,
  EducationLevel.PRIMARY_INCOMPLETE,
  EducationLevel.SECONDARY,
  EducationLevel.SECONDARY_INCOMPLETE,
  EducationLevel.TECHNICAL,
  EducationLevel.TECHNICAL_INCOMPLETE,
  EducationLevel.HIGHER,
  EducationLevel.HIGHER_INCOMPLETE,
  EducationLevel.NONE,
];

export const NATIVE_LANGUAGES = [
  'Castellano',
  'Castellano',
  'Castellano',
  'Quechua',
  'Aimara',
  'Shipibo-konibo',
] as const;

export const ENTRY_SOURCES: readonly {
  source: string;
  subSources: readonly string[];
}[] = [
  { source: 'REDES_SOCIALES', subSources: ['FACEBOOK', 'INSTAGRAM', 'TIKTOK'] },
  { source: 'REFERIDO', subSources: ['OTRO_PACIENTE', 'FAMILIAR', 'AMIGO'] },
  {
    source: 'HOSPITAL',
    subSources: ['TRABAJO_SOCIAL', 'CONSULTA_EXTERNA', 'ADMISION'],
  },
  { source: 'CAMPANA', subSources: ['FERIA_DE_SALUD', 'CHARLA_COMUNITARIA'] },
  { source: 'LINEA_TELEFONICA', subSources: ['LLAMADA_ENTRANTE', 'WHATSAPP'] },
];

export const FAMILY_TALKS = [
  'Manejo emocional del cuidador',
  'Nutrición durante la quimioterapia',
  'Derechos del paciente oncológico',
  'Trámites del SIS y FISSAL paso a paso',
  'Cuidados paliativos en casa',
] as const;

export const FOLLOW_UP_NOTES = {
  FIRST_CONTACT: [
    'Primer contacto. Se explicó el programa y aceptó recibir información.',
    'Contactó por redes sociales pidiendo apoyo para trámite de SIS.',
    'Familiar del paciente solicita orientación sobre continuidad del tratamiento.',
  ],
  ENROLLMENT: [
    'Se completó la ficha de afiliación y se registraron los consentimientos.',
    'Afiliación realizada con apoyo de la hija, quien será informante principal.',
    'Se registró el caso; paciente en tratamiento activo y con SIS vigente.',
  ],
  FOLLOW_UP: [
    'Refiere buena tolerancia al ciclo de quimioterapia. Sin eventos adversos.',
    'Reporta náuseas leves; se reforzaron indicaciones de nutrición.',
    'No pudo asistir a su cita por falta de recursos para el pasaje.',
    'Se coordinó con trabajo social para reprogramar la cita de oncología.',
    'Continúa con dolor moderado; se sugiere consulta con medicina del dolor.',
    'Recibió su medicación completa en farmacia del hospital.',
    'Paciente viajó a Lima para su control; permanecerá dos semanas con familiares.',
  ],
  PSYCHOONCOLOGY_REFERRAL: [
    'Se detecta ánimo bajo y aislamiento. Se deriva a psicooncología.',
    'La cuidadora principal presenta agotamiento; se ofrece apoyo psicológico.',
    'Paciente solicita apoyo emocional tras el cambio de esquema de tratamiento.',
  ],
  OTHER: [
    'Llamada de cortesía por fechas festivas.',
    'Se actualizaron los datos de contacto del paciente.',
  ],
} as const;

export const NO_ANSWER_NOTES = [
  'No contesta. Se intentará nuevamente en 48 horas.',
  'Buzón de voz. Se envió mensaje por WhatsApp.',
  'Teléfono apagado durante los tres intentos.',
] as const;

export const CANCELLED_NOTES = [
  'El paciente pidió reprogramar por consulta médica el mismo día.',
  'Se canceló por indisponibilidad del agente asignado.',
] as const;

export const REMINDER_DESCRIPTIONS = [
  'Confirmar asistencia a la cita de oncología',
  'Verificar entrega de medicación en farmacia',
  'Hacer seguimiento al trámite de afiliación al SIS',
  'Llamar tras el ciclo de quimioterapia para evaluar tolerancia',
  'Coordinar apoyo de transporte para el control mensual',
  'Recordar la charla familiar del sábado',
  'Solicitar copia del informe médico actualizado',
  'Confirmar que recibió la orden de exámenes de laboratorio',
  'Consultar si logró contactar con trabajo social',
  'Revisar el estado del expediente FISSAL',
] as const;

export const PSYCHO_TOPICS = [
  'Manejo de la ansiedad ante el tratamiento',
  'Aceptación del diagnóstico',
  'Comunicación con la familia sobre la enfermedad',
  'Agotamiento del cuidador principal',
  'Miedo a la recurrencia',
  'Duelo anticipatorio',
] as const;

export const PSYCHO_DETAILS = [
  'Sesión de contención emocional. Se trabajaron técnicas de respiración y se estableció una rutina de autocuidado.',
  'Se exploraron las preocupaciones económicas asociadas al tratamiento y su impacto en el estado de ánimo.',
  'Se abordó la dificultad para comunicar el diagnóstico a los hijos menores. Se dieron pautas concretas.',
  'La paciente expresa mejoría en el descanso nocturno respecto a la sesión anterior.',
] as const;

export const PSYCHO_RECOMMENDATIONS = [
  'Continuar con ejercicios de relajación diarios y agendar una segunda sesión en dos semanas.',
  'Involucrar a un familiar en las próximas sesiones para reforzar la red de soporte.',
  'Derivar a evaluación psiquiátrica si persisten los síntomas depresivos.',
] as const;

export const SYMPTOM_DESCRIPTIONS = [
  'Náuseas y falta de apetito después de cada ciclo',
  'Fatiga que limita las actividades del hogar',
  'Dolor localizado que aumenta por las noches',
  'Hormigueo en manos y pies tras la quimioterapia',
  'Dificultad para dormir por la preocupación',
] as const;

export const PAIN_LOCATIONS = [
  'Abdomen superior',
  'Zona lumbar',
  'Mama izquierda',
  'Pelvis',
  'Miembros inferiores',
] as const;

export const SIS_BLOCKERS = [
  'DNI caducado; debe renovarlo antes de afiliarse.',
  'Figura como asegurado en EsSalud por un empleo anterior.',
  'Domicilio declarado no coincide con el del DNI.',
] as const;
