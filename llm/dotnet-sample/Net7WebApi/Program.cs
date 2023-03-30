using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Options;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// inject FbClient as a singleton service
var o = new FbOptionsBuilder().Offline(true).Build();
var fb = new FbClient(o);
//var fbClient = new FbClient("G-7OCK3yKEuSHGx_TIuf0QptatEO5JU0-z8TJeCzNZ6w");
builder.Services.AddSingleton(fb);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();