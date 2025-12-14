  const Punching = require('../models/Punching');
  const Employee = require('../models/Employee');
  const Rota = require('../models/Rota');

  /**
   * Helper: compute hours between two Date objects in decimal hours
   */
  function hoursBetween(start, end) {
    if (!start || !end) return 0;
    const ms = Math.max(0, end - start);
    return ms / (1000 * 60 * 60);
  }

  /**
   * Calculate salary for an employee over a date range
   * - pulls punchings (uses punch in/out). Fallback to rotas scheduled times if needed.
   * - supports payType 'Hourly' and 'Fixed Daily'
   */
  async function calculateSalaryForEmployee(employeeId, startDate, endDate) {
    const emp = await Employee.findById(employeeId);
    if (!emp) throw new Error('Employee not found');

    // choose rate: custom if set otherwise base
    const hourlyRate = emp.customHourlyRate ?? emp.hourlyRate ?? 0;
    const dailyRate = emp.customDailyRate ?? emp.fixedDailyRate ?? 0;

    // fetch punchings for employee within range
    const punches = await Punching.find({
      employee: emp._id,
      punchInDatetime: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });

    let totalHours = 0;
    let daysWorked = new Set();

    punches.forEach(p => {
      const inT = p.punchInDatetime;
      const outT = p.punchOutDatetime || new Date(); // if still punched in, use now
      const h = hoursBetween(inT, outT);
      totalHours += h;
      const dayStr = inT.toISOString().slice(0,10);
      daysWorked.add(dayStr);
    });

    // Fallback: If no punches but rotas exist -> count scheduled shifts as worked maybe for fixed daily
    const rotas = await Rota.find({
      employee: emp._id,
      shiftDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });

    rotas.forEach(r => {
      const d = r.shiftDate.toISOString().slice(0,10);
      if (!daysWorked.has(d)) {
        // parse scheduledStart & scheduledEnd if present
        if (r.scheduledStart && r.scheduledEnd) {
          const start = new Date(r.shiftDate);
          const [sh, sm] = r.scheduledStart.split(':').map(Number);
          const [eh, em] = r.scheduledEnd.split(':').map(Number);
          start.setHours(sh, sm, 0, 0);
          const end = new Date(r.shiftDate);
          end.setHours(eh, em, 0, 0);
          const h = hoursBetween(start, end);
          totalHours += h;
          daysWorked.add(d);
        } else {
          // count a day but no hours
          daysWorked.add(d);
        }
      }
    });

    const numDaysWorked = daysWorked.size;

    let salary = 0;
    if (emp.payType === 'Hourly') {
      salary = totalHours * hourlyRate;
    } else { // Fixed Daily
      salary = numDaysWorked * dailyRate;
    }

    return {
      employeeId: emp._id,
      employeeName: emp.name,
      payType: emp.payType,
      totalHours,
      daysWorked: numDaysWorked,
      hourlyRate,
      dailyRate,
      salary
    };
  }



/**
 * Standalone function: Calculate detailed salary summary for an employee
 * Returns daily breakdown including hours, punch/rota source, and totals
 */
async function calculateSalarySummary(employeeId, startDate, endDate) {
  const emp = await Employee.findById(employeeId);
  if (!emp) throw new Error('Employee not found');

  const hourlyRate = emp.customHourlyRate ?? emp.hourlyRate ?? 0;
  const dailyRate = emp.customDailyRate ?? emp.fixedDailyRate ?? 0;

  // 1️⃣ Fetch punches in range
  const punches = await Punching.find({
    employee: emp._id,
    punchInDatetime: { $gte: new Date(startDate), $lte: new Date(endDate) }
  });

  // Map day -> daily info
  const dailySummary = {};

  punches.forEach(p => {
    const inT = p.punchInDatetime;
    const outT = p.punchOutDatetime || new Date();
    const h = hoursBetween(inT, outT);
    const dayStr = inT.toISOString().slice(0,10);

    dailySummary[dayStr] = {
      date: dayStr,
      hours: h,
      source: 'Punch',
      punchIn: inT,
      punchOut: outT
    };
  });

  // 2️⃣ Fallback: Rota shifts
  const rotas = await Rota.find({
    employee: emp._id,
    shiftDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
  });

  rotas.forEach(r => {
    const dayStr = r.shiftDate.toISOString().slice(0,10);

    if (!dailySummary[dayStr]) {
      if (r.scheduledStart && r.scheduledEnd) {
        const start = new Date(r.shiftDate);
        const [sh, sm] = r.scheduledStart.split(':').map(Number);
        start.setHours(sh, sm, 0, 0);

        const end = new Date(r.shiftDate);
        const [eh, em] = r.scheduledEnd.split(':').map(Number);
        end.setHours(eh, em, 0, 0);

        const h = hoursBetween(start, end);

        dailySummary[dayStr] = {
          date: dayStr,
          hours: h,
          source: 'Rota',
          scheduledStart: r.scheduledStart,
          scheduledEnd: r.scheduledEnd
        };
      } else {
        dailySummary[dayStr] = {
          date: dayStr,
          hours: 0,
          source: 'Rota',
          note: 'No scheduled time'
        };
      }
    }
  });

  // 3️⃣ Totals
  const totalHours = Object.values(dailySummary).reduce((sum, d) => sum + d.hours, 0);
  const totalDays = Object.keys(dailySummary).length;

  const salary = emp.payType === 'Hourly' ? totalHours * hourlyRate : totalDays * dailyRate;

  return {
    employeeId: emp._id,
    employeeName: emp.name,
    payType: emp.payType,
    hourlyRate,
    dailyRate,
    totalHours,
    totalDays,
    salary,
    dailyBreakdown: Object.values(dailySummary).sort((a,b) => new Date(a.date) - new Date(b.date))
  };
}

  module.exports = { calculateSalaryForEmployee,calculateSalarySummary };
