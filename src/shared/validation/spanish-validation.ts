import { BadRequestException, ValidationError } from '@nestjs/common';

// Nombres legibles de los campos que llegan desde los formularios. Un campo que no
// está aquí se reporta sin nombre: nunca se muestra el nombre interno de la API.
const FIELD_LABELS: Record<string, string> = {
  fullName: 'el nombre',
  name: 'el nombre',
  dni: 'el documento',
  documentType: 'el tipo de documento',
  birthDate: 'la fecha de nacimiento',
  gender: 'el sexo',
  email: 'el correo',
  password: 'la contraseña',
  primaryPhone: 'el teléfono principal',
  secondaryPhone: 'el teléfono secundario',
  relationship: 'el parentesco',
  role: 'el rol',
  address: 'la dirección',
  department: 'el departamento',
  province: 'la provincia',
  district: 'el distrito',
  ubigeoDistrictCode: 'el ubigeo del distrito',
  renipressCode: 'el código RENIPRESS',
  careCategory: 'la categoría de atención',
  institution: 'la institución',
  healthCenterId: 'el establecimiento',
  primaryHealthCenterId: 'el hospital principal',
  originHealthCenterId: 'el establecimiento de origen',
  destinationHealthCenterId: 'el establecimiento de destino',
  sourceHealthCenterId: 'el hospital de origen',
  receivingHealthCenterId: 'el hospital receptor',
  referredHealthCenterId: 'el establecimiento de referencia',
  agentId: 'el agente',
  assignedAgentId: 'el agente responsable',
  volunteerId: 'el voluntario',
  companionId: 'el acompañante',
  patientId: 'el paciente',
  followUpId: 'el seguimiento',
  followUpIds: 'los seguimientos',
  diagnosisId: 'el diagnóstico',
  treatmentId: 'el tratamiento',
  availabilityId: 'el horario',
  diagnosis: 'el diagnóstico',
  diagnosisDate: 'la fecha de diagnóstico',
  cancerStage: 'el estadio',
  firstSymptomsDate: 'la fecha de primeros síntomas',
  treatmentType: 'el tipo de tratamiento',
  treatmentSituation: 'la situación del tratamiento',
  treatmentFrequency: 'la frecuencia del tratamiento',
  interruptionReason: 'el motivo de interrupción',
  treatmentAbandonmentReason: 'el motivo de abandono',
  startDate: 'la fecha de inicio',
  endDate: 'la fecha de fin',
  startTime: 'la hora de inicio',
  daysOfWeek: 'los días de la semana',
  hours: 'las horas',
  scheduledAt: 'la fecha programada',
  scheduledOn: 'la fecha programada',
  completedAt: 'la fecha de realización',
  completedOn: 'la fecha de realización',
  dueOn: 'la fecha del recordatorio',
  remindAt: 'la fecha del recordatorio',
  reminderMode: 'el tipo de recordatorio',
  lead: 'la anticipación',
  channel: 'el canal',
  outcome: 'el resultado',
  occurredAt: 'la fecha del intento',
  status: 'el estado',
  type: 'el tipo',
  modality: 'la modalidad',
  specialty: 'la especialidad',
  appointmentDate: 'la fecha de la cita',
  appointmentTime: 'la hora de la cita',
  requestedOn: 'la fecha de solicitud',
  issuedOn: 'la fecha de emisión',
  attendedOn: 'la fecha de atención',
  reason: 'el motivo',
  deactivationReason: 'el motivo de baja',
  deceasedAt: 'la fecha de fallecimiento',
  description: 'la descripción',
  title: 'el título',
  notes: 'las notas',
  note: 'la nota',
  comment: 'el comentario',
  resolutionNotes: 'la nota de resolución',
  severity: 'la severidad',
  category: 'la categoría',
  rating: 'la calificación',
  satisfactionRating: 'la calificación',
  code: 'el código',
  label: 'la etiqueta',
  kind: 'el catálogo',
  insuranceType: 'el tipo de seguro',
  epsProvider: 'el proveedor EPS',
  educationLevel: 'el grado de instrucción',
  nativeLanguage: 'la lengua materna',
  zoneType: 'la zonificación',
  healthPhase: 'la fase de salud',
  healthSubcategory: 'la subcategoría',
  zoomLink: 'el enlace de Zoom',
  from: 'la fecha «Desde»',
  to: 'la fecha «Hasta»',
  year: 'el año',
  month: 'el mes',
  period: 'el periodo',
  population: 'la población',
};

function fieldLabel(property: string): string | undefined {
  return FIELD_LABELS[property];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function messageFor(
  property: string,
  constraint: string,
  missing: boolean,
): string {
  const field = fieldLabel(property);
  if (constraint === 'whitelistValidation') {
    return 'Se envió un dato que el formulario no admite.';
  }
  if (!field)
    return 'Hay un dato inválido en el formulario. Revisa los campos.';
  if (missing) {
    const isChoice =
      property.endsWith('Id') ||
      property.endsWith('Ids') ||
      ['isUUID', 'isEnum', 'isIn', 'isBoolean'].includes(constraint);
    return `${isChoice ? 'Selecciona' : 'Completa'} ${field}.`;
  }
  // Concordancia: «Las horas superan…», «El nombre supera…».
  const plural = /^(los|las) /.test(field);
  const has = plural ? 'tienen' : 'tiene';
  const is = plural ? 'son' : 'es';
  const isAt = plural ? 'están' : 'está';
  switch (constraint) {
    case 'isNotEmpty':
    case 'isDefined':
    case 'arrayNotEmpty':
    case 'arrayMinSize':
      return `Completa ${field}.`;
    case 'isEmail':
      return 'El correo no tiene un formato válido.';
    case 'isDateString':
    case 'isISO8601':
    case 'isDate':
    case 'minDate':
    case 'maxDate':
      return plural
        ? `${capitalize(field)} no son fechas válidas.`
        : `${capitalize(field)} no es una fecha válida.`;
    case 'minLength':
      return `${capitalize(field)} ${has} muy pocos caracteres.`;
    case 'maxLength':
      return `${capitalize(field)} ${has} demasiados caracteres.`;
    case 'min':
      return `${capitalize(field)} ${isAt} por debajo del mínimo permitido.`;
    case 'max':
      return `${capitalize(field)} ${plural ? 'superan' : 'supera'} el máximo permitido.`;
    case 'isEnum':
    case 'isIn':
      return `${capitalize(field)} no ${is} ${plural ? 'opciones válidas' : 'una opción válida'}.`;
    default:
      return `${capitalize(field)} no ${has} un valor válido.`;
  }
}

function collect(errors: ValidationError[], out: string[]): void {
  for (const error of errors) {
    if (error.constraints) {
      // isNotEmpty es el aviso más útil; los demás sobre el mismo campo sobran.
      const keys = Object.keys(error.constraints);
      const key = keys.includes('isNotEmpty')
        ? 'isNotEmpty'
        : keys.includes('isDefined')
          ? 'isDefined'
          : keys[0];
      const missing =
        error.value === undefined ||
        error.value === null ||
        (typeof error.value === 'string' && error.value.trim() === '');
      out.push(messageFor(error.property, key, missing));
    }
    if (error.children?.length) collect(error.children, out);
  }
}

export function spanishValidationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const messages: string[] = [];
  collect(errors, messages);
  return new BadRequestException([...new Set(messages)]);
}
