using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using SmarterMeterUI.Models;
using SmarterMeterUI.Services;

namespace SmarterMeterUI.Pages;

/// <summary>
/// Index page model — fetches meter readings and calculates costs.
/// </summary>
/// <param name="meterService">The meter service used to fetch data.</param>
public class IndexModel(MeterService meterService) : PageModel
{
    /// <summary>
    /// All readings fetched from the API.
    /// </summary>
    public List<MeterReading> Readings { get; set; } = [];

    /// <summary>
    /// The most recent reading.
    /// </summary>
    public MeterReading? LatestReading { get; set; }

    /// <summary>
    /// Unit rate in pence.
    /// </summary>
    public decimal UnitRatePence { get; set; }

    /// <summary>
    /// Standing charge in pence.
    /// </summary>
    public decimal StandingChargePence { get; set; }

    /// <summary>
    /// All configured tariff periods, loaded from appsettings.json.
    /// </summary>
    public List<Tariff> Tariffs { get; set; } = [];

    /// <summary>
    /// Loads tariff periods, meter readings, and the latest reading for display. Redirects to the login page if the session is not authenticated.
    /// </summary>
    /// <returns>The page result, or a redirect to the login page if unauthenticated.</returns>
    public async Task<IActionResult> OnGetAsync()
    {
        // Check if authenticated session exists
        if (HttpContext.Session.GetString("authenticated") != "true")
            return RedirectToPage("/Login");

        // Load all tariff information and readings
        Tariffs = await meterService.GetTariffsAsync();
        Readings = await meterService.GetReadingsAsync(5000);
        Readings = [.. Readings.OrderBy(r => r.CapturedAt)];
        LatestReading = Readings.LastOrDefault();
        return Page();
    }

    /// <summary>
    /// Calculates the total cost in pounds for a set of readings, splitting by tariff
    /// period so a provider switch mid-range is costed correctly on each side.
    /// </summary>
    /// <param name="readings">The readings to calculate cost for, ordered by CapturedAt.</param>
    /// <param name="rangeStart">The first calendar day the range covers (inclusive).</param>
    /// <param name="rangeEnd">The last calendar day the range covers (inclusive).</param>
    public decimal CalculateCostForRange(List<MeterReading> readings, DateTime rangeStart, DateTime rangeEnd)
    {
        if (readings.Count < 2) return 0;

        decimal totalCost = 0;

        foreach (Tariff tariff in Tariffs)
        {
            // Clip the tariff's date range to the requested range
            DateTime periodStart = rangeStart.Date > tariff.StartDate.Date ? rangeStart.Date : tariff.StartDate.Date;
            DateTime periodEnd = rangeEnd.Date < tariff.EndDate.Date ? rangeEnd.Date : tariff.EndDate.Date;

            if (periodStart > periodEnd) continue;

            // Days this tariff actually covers within the requested range, inclusive
            int days = (periodEnd - periodStart).Days + 1;

            // Readings that fall within this clipped period
            List<MeterReading> periodReadings = [.. readings.Where(r =>
            r.CapturedAt.Date >= periodStart && r.CapturedAt.Date <= periodEnd)];

            decimal usage = periodReadings.Count >= 2 ? periodReadings.Last().Value - periodReadings.First().Value : 0;

            totalCost += (usage * tariff.UnitRatePence + days * tariff.StandingChargePence) / 100;
        }

        return Math.Round(totalCost, 2);
    }
}