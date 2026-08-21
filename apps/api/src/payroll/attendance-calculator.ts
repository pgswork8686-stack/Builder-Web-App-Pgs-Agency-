/**
 * PGS ATTENDANCE PENALTY & BONUS CALCULATOR
 * Pure functions implementing authoritative PGS business rules.
 */

export interface AttendancePenaltyOccurrence {
  lateMinutes: number;
  penaltyAmount: number;
}

export interface AttendancePenaltyResult {
  totalPenalty: number;
  lateOccurrences: number;
  totalLateMinutes: number;
  occurrences: AttendancePenaltyOccurrence[];
}

export interface AttendanceBonusInput {
  lateOccurrences: number;
  absenceDays: number;
  unapprovedEarlyLeaveOccurrences: number;
  disciplineEligible: boolean;
}

export interface AttendanceBonusResult {
  bonusEligible: boolean;
  bonusAmount: number;
}

/**
 * Calculates monetary attendance penalty for late check-in occurrences in a month.
 *
 * PGS Policy:
 * - 0 min: 0 VND (On-time)
 * - 1..4 min: 0 VND monetary penalty (Recorded as a late occurrence)
 * - 5..20 min: 50,000 VND per occurrence
 * - 21..30 min: 100,000 VND per occurrence
 * - >=31 min: 150,000 VND per occurrence
 *
 * Note: Late minutes are NOT automatically deducted from base salary.
 */
export function calculateAttendancePenalty(
  lateMinutesList: number[],
): AttendancePenaltyResult {
  let totalPenalty = 0;
  let totalLateMinutes = 0;
  let lateOccurrences = 0;
  const occurrences: AttendancePenaltyOccurrence[] = [];

  for (const minutes of lateMinutesList) {
    if (minutes <= 0) {
      continue;
    }

    lateOccurrences += 1;
    totalLateMinutes += minutes;

    let penalty = 0;
    if (minutes >= 1 && minutes <= 4) {
      penalty = 0;
    } else if (minutes >= 5 && minutes <= 20) {
      penalty = 50_000;
    } else if (minutes >= 21 && minutes <= 30) {
      penalty = 100_000;
    } else if (minutes >= 31) {
      penalty = 150_000;
    }

    totalPenalty += penalty;
    occurrences.push({
      lateMinutes: minutes,
      penaltyAmount: penalty,
    });
  }

  return {
    totalPenalty,
    lateOccurrences,
    totalLateMinutes,
    occurrences,
  };
}

/**
 * Evaluates monthly attendance bonus eligibility and amount.
 *
 * PGS Policy:
 * Monthly bonus: 250,000 VND
 * Eligible ONLY when ALL conditions are met:
 * 1. total late occurrences <= 3 (including 1-4 min lates)
 * 2. no absence on scheduled working days in the month (absenceDays === 0)
 * 3. no unapproved early-leave sessions counted as absence (unapprovedEarlyLeaveOccurrences === 0)
 * 4. employee is eligible under discipline/internal rules (disciplineEligible === true)
 */
export function calculateAttendanceBonus(
  input: AttendanceBonusInput,
): AttendanceBonusResult {
  const isEligible =
    input.lateOccurrences <= 3 &&
    input.absenceDays <= 0 &&
    input.unapprovedEarlyLeaveOccurrences <= 0 &&
    input.disciplineEligible === true;

  return {
    bonusEligible: isEligible,
    bonusAmount: isEligible ? 250_000 : 0,
  };
}
