import {
  AppointmentModality,
  AppointmentStatus,
  PsychooncologyAppointment,
} from '../../entities/psychooncology-appointment.entity';
import type { Volunteer } from '../../entities/volunteer.entity';
import {
  AvailabilityStatus,
  VolunteerAvailability,
} from '../../entities/volunteer-availability.entity';
import {
  PSYCHO_DETAILS,
  PSYCHO_RECOMMENDATIONS,
  PSYCHO_TOPICS,
} from './catalog';
import type { DemoContext } from './context';
import type { PatientFollowUps } from './follow-ups';
import { PatientActivityStatus } from '../../entities/patient-activity-status.enum';
import { addDays, addMinutes, atTime, toDateOnly } from './rng';

const TARGET_APPOINTMENTS = 10;

/**
 * Each volunteer keeps their own fixed hours. A GiST EXCLUDE constraint
 * (`EX_volunteer_availability_no_overlap`) rejects overlapping ranges for the
 * same volunteer and day, so slots come from a fixed grid rather than the RNG.
 */
const VOLUNTEER_HOURS: readonly (readonly number[])[] = [
  [9, 11],
  [15, 17],
  [10, 16],
];

/** Offsets from the Monday of the current week: last week, this one, the next. */
const WEEK_OFFSETS = [-7, 0, 7];
/** Monday, Wednesday, Friday. */
const WEEKDAY_OFFSETS = [0, 2, 4];

interface Slot {
  availability: VolunteerAvailability;
  volunteer: Volunteer;
  startsAt: Date;
}

export async function seedPsychooncology(
  ctx: DemoContext,
  histories: PatientFollowUps[],
  volunteers: Volunteer[],
): Promise<void> {
  const { manager, rng, now } = ctx;

  const mondayThisWeek = addDays(now, -((now.getUTCDay() + 6) % 7));

  const rows: VolunteerAvailability[] = [];
  const starts: Date[] = [];
  const owners: Volunteer[] = [];

  volunteers.forEach((volunteer, volunteerIndex) => {
    const hours = VOLUNTEER_HOURS[volunteerIndex % VOLUNTEER_HOURS.length];

    for (const weekOffset of WEEK_OFFSETS) {
      for (const weekdayOffset of WEEKDAY_OFFSETS) {
        const day = addDays(mondayThisWeek, weekOffset + weekdayOffset);

        for (const hour of hours) {
          rows.push(
            manager.create(VolunteerAvailability, {
              volunteerId: volunteer.id,
              date: toDateOnly(day),
              startTime: `${String(hour).padStart(2, '0')}:00:00`,
              endTime: `${String(hour + 1).padStart(2, '0')}:00:00`,
              status: AvailabilityStatus.AVAILABLE,
            }),
          );
          starts.push(atTime(day, hour));
          owners.push(volunteer);
        }
      }
    }
  });

  const availabilities = await manager.save(rows);
  const slots: Slot[] = availabilities.map((availability, index) => ({
    availability,
    volunteer: owners[index],
    startsAt: starts[index],
  }));

  const pastSlots = rng.shuffle(slots.filter((slot) => slot.startsAt < now));
  const futureSlots = rng.shuffle(slots.filter((slot) => slot.startsAt >= now));

  // Patients still in the program, referrals first — they are the ones a
  // psychooncology session would realistically have been booked for.
  const candidates = histories.filter(
    (history) =>
      history.enrollment !== null &&
      history.demoPatient.patient.activityStatus !==
        PatientActivityStatus.INACTIVE,
  );
  const ordered = [
    ...candidates.filter((history) => history.psychoReferral),
    ...rng.shuffle(candidates.filter((history) => !history.psychoReferral)),
  ];

  const appointments: PsychooncologyAppointment[] = [];
  const reserved: VolunteerAvailability[] = [];

  for (const history of ordered) {
    if (appointments.length >= TARGET_APPOINTMENTS) break;

    const { patient } = history.demoPatient;
    const sessions = rng.int(1, 2);

    for (let session = 1; session <= sessions; session += 1) {
      if (appointments.length >= TARGET_APPOINTMENTS) break;

      // First session in the past, follow-ups upcoming, mirroring real usage.
      const wantsPast = session === 1 && pastSlots.length > 0;
      const slot = wantsPast ? pastSlots.pop() : futureSlots.pop();
      if (!slot) break;

      const isPast = slot.startsAt < now;
      slot.availability.status = AvailabilityStatus.RESERVED;
      reserved.push(slot.availability);

      appointments.push(
        manager.create(PsychooncologyAppointment, {
          patientId: patient.id,
          volunteerId: slot.volunteer.id,
          followUpId: history.psychoReferral?.id ?? null,
          availabilityId: slot.availability.id,
          patientEmail: patient.email,
          sessionNumber: session,
          isAdditionalSession: session > 1,
          modality: rng.bool(0.6)
            ? AppointmentModality.VIDEO_CALL
            : AppointmentModality.CALL,
          status: isPast
            ? AppointmentStatus.COMPLETED
            : AppointmentStatus.SCHEDULED,
          scheduledAt: slot.startsAt,
          completedAt: isPast ? addMinutes(slot.startsAt, 50) : null,
          topicAddressed: isPast ? rng.pick(PSYCHO_TOPICS) : null,
          sessionDetails: isPast ? rng.pick(PSYCHO_DETAILS) : null,
          additionalObservations:
            isPast && rng.bool(0.4)
              ? 'Se sugiere involucrar al cuidador principal en la siguiente sesión.'
              : null,
          recommendations: isPast ? rng.pick(PSYCHO_RECOMMENDATIONS) : null,
          referral: isPast && rng.bool(0.2) ? 'PSIQUIATRIA' : null,
        }),
      );
    }
  }

  await manager.save(appointments);
  await manager.save(reserved);
}
