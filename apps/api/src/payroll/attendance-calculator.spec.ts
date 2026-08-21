import {
  calculateAttendancePenalty,
  calculateAttendanceBonus,
} from './attendance-calculator';

describe('PGS Attendance Penalty & Bonus Calculator', () => {
  describe('calculateAttendancePenalty', () => {
    it('returns 0 for on-time arrivals (<= 0 minutes)', () => {
      const result = calculateAttendancePenalty([0, -5]);
      expect(result.totalPenalty).toBe(0);
      expect(result.lateOccurrences).toBe(0);
      expect(result.totalLateMinutes).toBe(0);
    });

    it('returns 0 monetary penalty for 1-4 minutes late, but records occurrence and minutes', () => {
      const result = calculateAttendancePenalty([1, 4]);
      expect(result.totalPenalty).toBe(0);
      expect(result.lateOccurrences).toBe(2);
      expect(result.totalLateMinutes).toBe(5);
    });

    it('charges 50,000 VND per occurrence for 5-20 minutes late', () => {
      const result = calculateAttendancePenalty([5, 10, 20]);
      expect(result.totalPenalty).toBe(150_000);
      expect(result.lateOccurrences).toBe(3);
      expect(result.totalLateMinutes).toBe(35);
    });

    it('charges 100,000 VND per occurrence for 21-30 minutes late', () => {
      const result = calculateAttendancePenalty([21, 30]);
      expect(result.totalPenalty).toBe(200_000);
      expect(result.lateOccurrences).toBe(2);
      expect(result.totalLateMinutes).toBe(51);
    });

    it('charges 150,000 VND per occurrence for >30 minutes late', () => {
      const result = calculateAttendancePenalty([31, 60]);
      expect(result.totalPenalty).toBe(300_000);
      expect(result.lateOccurrences).toBe(2);
      expect(result.totalLateMinutes).toBe(91);
    });

    it('correctly aggregates mixed late tiers across the month', () => {
      // 1x (3 min = 0 VND), 1x (15 min = 50k), 1x (25 min = 100k), 1x (45 min = 150k)
      const result = calculateAttendancePenalty([3, 15, 25, 45]);
      expect(result.totalPenalty).toBe(300_000);
      expect(result.lateOccurrences).toBe(4);
      expect(result.totalLateMinutes).toBe(88);
    });
  });

  describe('calculateAttendanceBonus', () => {
    it('awards 250,000 VND when late <= 3, 0 absence, 0 unapproved early leave, and discipline eligible', () => {
      const result = calculateAttendanceBonus({
        lateOccurrences: 3,
        absenceDays: 0,
        unapprovedEarlyLeaveOccurrences: 0,
        disciplineEligible: true,
      });
      expect(result.bonusEligible).toBe(true);
      expect(result.bonusAmount).toBe(250_000);
    });

    it('disqualifies bonus when late occurrences > 3 (even if all are under 5 mins)', () => {
      const result = calculateAttendanceBonus({
        lateOccurrences: 4,
        absenceDays: 0,
        unapprovedEarlyLeaveOccurrences: 0,
        disciplineEligible: true,
      });
      expect(result.bonusEligible).toBe(false);
      expect(result.bonusAmount).toBe(0);
    });

    it('disqualifies bonus when there is any absence day', () => {
      const result = calculateAttendanceBonus({
        lateOccurrences: 0,
        absenceDays: 1,
        unapprovedEarlyLeaveOccurrences: 0,
        disciplineEligible: true,
      });
      expect(result.bonusEligible).toBe(false);
      expect(result.bonusAmount).toBe(0);
    });

    it('disqualifies bonus when there is unapproved early leave', () => {
      const result = calculateAttendanceBonus({
        lateOccurrences: 0,
        absenceDays: 0,
        unapprovedEarlyLeaveOccurrences: 1,
        disciplineEligible: true,
      });
      expect(result.bonusEligible).toBe(false);
      expect(result.bonusAmount).toBe(0);
    });

    it('disqualifies bonus when discipline review is false', () => {
      const result = calculateAttendanceBonus({
        lateOccurrences: 0,
        absenceDays: 0,
        unapprovedEarlyLeaveOccurrences: 0,
        disciplineEligible: false,
      });
      expect(result.bonusEligible).toBe(false);
      expect(result.bonusAmount).toBe(0);
    });
  });
});
