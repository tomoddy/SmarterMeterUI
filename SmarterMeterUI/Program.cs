using SmarterMeterUI.Services;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddHttpClient();
builder.Services.AddHttpClient<MeterService>();

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(12);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

WebApplication app = builder.Build();

app.UseExceptionHandler("/Error");
app.UseRouting();
app.UseSession();
app.MapStaticAssets();
app.MapRazorPages().WithStaticAssets();
app.Run();