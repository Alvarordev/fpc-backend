import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { ListPatientsDto } from './dto/list-patients.dto';

/** Current clinical facts; provenance never excludes a patient or an event. */
export function applyPatientSearchFilters(
  query: SelectQueryBuilder<Patient>,
  filters: ListPatientsDto,
) {
  if (
    filters.minAge != null &&
    filters.maxAge != null &&
    filters.minAge > filters.maxAge
  )
    throw new BadRequestException(
      'La edad mínima no puede ser mayor que la máxima.',
    );
  if (
    filters.enrolledFrom &&
    filters.enrolledTo &&
    filters.enrolledFrom >= filters.enrolledTo
  )
    throw new BadRequestException(
      'El inicio del rango de enrolamiento debe ser anterior al fin.',
    );

  for (const [value, expression] of [
    [filters.hasEmail, "NULLIF(BTRIM(patient.email), '') IS NOT NULL"],
    [
      filters.hasPhone,
      "(NULLIF(BTRIM(patient.primary_phone), '') IS NOT NULL OR NULLIF(BTRIM(patient.secondary_phone), '') IS NOT NULL)",
    ],
    [
      filters.hasCompanion,
      'EXISTS (SELECT 1 FROM companion_patient cp WHERE cp.patient_id = patient.id)',
    ],
    [
      filters.hasPendingReminders,
      "EXISTS (SELECT 1 FROM reminders r WHERE r.subject_patient_id = patient.id AND r.status = 'PENDING')",
    ],
    [
      filters.hasPendingFollowUps,
      "EXISTS (SELECT 1 FROM follow_ups f WHERE f.subject_patient_id = patient.id AND (f.status = 'SCHEDULED' OR (f.status = 'OVERDUE' AND f.next_follow_up_id IS NULL)))",
    ],
  ] as const) {
    if (value != null)
      query.andWhere(value ? expression : `NOT (${expression})`);
  }
  const age =
    "DATE_PART('year', AGE((NOW() AT TIME ZONE 'America/Lima')::date, patient.birth_date))";
  if (filters.minAge != null)
    query.andWhere(`${age} >= :minAge`, { minAge: filters.minAge });
  if (filters.maxAge != null)
    query.andWhere(`${age} <= :maxAge`, { maxAge: filters.maxAge });
  if (filters.gender)
    query.andWhere('patient.gender = :gender', { gender: filters.gender });
  if (filters.department)
    query.andWhere(
      `EXISTS (SELECT 1 FROM patient_addresses a WHERE a.patient_id = patient.id AND a.is_primary = true AND a.is_active = true AND REPLACE(UPPER(BTRIM(a.department)), '_', ' ') = REPLACE(UPPER(BTRIM(:residenceDepartment)), '_', ' '))`,
      { residenceDepartment: filters.department },
    );
  if (filters.healthCenterId)
    query.andWhere(
      'details.primary_health_center_id = :primaryHealthCenterId',
      { primaryHealthCenterId: filters.healthCenterId },
    );

  // Pair clinical predicates on the same current row. Separate EXISTS clauses
  // would incorrectly match a diagnosis/stage or treatment/situation from two rows.
  for (const [table, alias, fields] of [
    [
      'patient_diagnoses',
      'd',
      [
        ['diagnosis', filters.diagnosis],
        ['cancer_stage', filters.cancerStage],
      ],
    ],
    [
      'patient_treatments',
      't',
      [
        ['treatment_type', filters.treatmentType],
        ['treatment_situation', filters.treatmentSituation],
      ],
    ],
    ['patient_insurance', 'i', [['insurance_type', filters.insuranceType]]],
  ] as const) {
    const predicates = [
      `${alias}.patient_id = patient.id`,
      `${alias}.is_current = true`,
    ];
    const parameters: Record<string, string> = {};
    for (const [column, value] of fields) {
      if (!value) continue;
      const parameter = `patientFilter_${column}`;
      predicates.push(`${alias}.${column} = :${parameter}`);
      parameters[parameter] = value;
    }
    if (Object.keys(parameters).length)
      query.andWhere(
        `EXISTS (SELECT 1 FROM ${table} ${alias} WHERE ${predicates.join(' AND ')})`,
        parameters,
      );
  }
  const firstEnrollment =
    '(SELECT MIN(e.enrolled_on) FROM enrollments e WHERE e.patient_id = patient.id)';
  if (filters.enrolledFrom)
    query.andWhere(`${firstEnrollment} >= :enrolledFrom::date`, {
      enrolledFrom: filters.enrolledFrom,
    });
  if (filters.enrolledTo)
    query.andWhere(`${firstEnrollment} < :enrolledTo::date`, {
      enrolledTo: filters.enrolledTo,
    });
  if (filters.lastContactBefore)
    query.andWhere(
      `(SELECT MAX(COALESCE(f.completed_on, (f.completed_at AT TIME ZONE 'America/Lima')::date)) FROM follow_ups f WHERE f.subject_patient_id = patient.id AND f.status = 'COMPLETED') < :lastContactBefore::date`,
      { lastContactBefore: filters.lastContactBefore },
    );
}
