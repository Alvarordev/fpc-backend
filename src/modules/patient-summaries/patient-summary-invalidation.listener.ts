import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PatientDataChangedEvent,
  PATIENT_DATA_CHANGED,
} from './patient-data-changed.event';
import { PatientSummaryStateService } from './patient-summary-state.service';

@Injectable()
export class PatientSummaryInvalidationListener {
  constructor(private readonly states: PatientSummaryStateService) {}

  @OnEvent(PATIENT_DATA_CHANGED)
  handle(event: PatientDataChangedEvent): Promise<void> {
    return this.states.markPending(event.patientId);
  }
}
