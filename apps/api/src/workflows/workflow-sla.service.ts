import { Injectable } from '@nestjs/common';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';

@Injectable()
export class WorkflowSlaService {
  constructor(private readonly workCalendarService: WorkCalendarService) {}

  async addWorkingHours(startDate: Date, hours: number): Promise<Date> {
    let remainingHours = hours;
    const current = new Date(startDate);

    while (remainingHours > 0) {
      const dateStr = current.toISOString().substring(0, 10);
      const dayInfo = await this.workCalendarService.resolveDay(dateStr);

      if (dayInfo.isWorkingDay) {
        const hoursToDeduct = Math.min(remainingHours, 8);
        current.setUTCHours(current.getUTCHours() + hoursToDeduct);
        remainingHours -= hoursToDeduct;
      }
      if (remainingHours > 0) {
        current.setUTCDate(current.getUTCDate() + 1);
        current.setUTCHours(8, 0, 0, 0);
      }
    }
    return current;
  }
}
