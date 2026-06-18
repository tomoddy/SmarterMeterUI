using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using SmarterMeterUI.Models;
using SmarterMeterUI.Services;

namespace SmarterMeterUI.Pages;

/// <summary>
/// Index page model — fetches meter readings and calculates costs.
/// </summary>
public class IndexModel(MeterService meterService, IConfiguration config) : PageModel
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
    /// Fetches readings and calculates tariff on page load.
    /// </summary>
    public async Task<IActionResult> OnGetAsync()
    {
        if (HttpContext.Session.GetString("authenticated") != "true")
            return RedirectToPage("/Login");

        UnitRatePence = config.GetValue<decimal>("SmarterMeter:Tariff:UnitRatePence");
        StandingChargePence = config.GetValue<decimal>("SmarterMeter:Tariff:StandingChargePence");

        Readings = await meterService.GetReadingsAsync(5000);
        Readings = [.. Readings.OrderBy(r => r.CapturedAt)];

        LatestReading = Readings.LastOrDefault();
        return Page();
    }

    /// <summary>
    /// Calculates the cost in pounds for a given kWh consumption.
    /// </summary>
    /// <param name="kwh">Energy consumed in kWh.</param>
    /// <param name="days">Number of days to include standing charge for.</param>
    public decimal CalculateCost(decimal kwh, int days = 1)
    {
        decimal unitCost = kwh * UnitRatePence;
        decimal standingCost = StandingChargePence * days;
        return Math.Round((unitCost + standingCost) / 100, 2);
    }
}