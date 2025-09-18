using ConsultorioMedico.API.Data;
using ConsultorioMedico.API.Models;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Configurar Entity Framework
builder.Services.AddDbContext<ConsultorioDbContext>(options =>
    options.UseMySql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        new MySqlServerVersion(new Version(8, 0, 23)) // Ajusta la versión según tu MAMP
    ));

// Configurar CORS para permitir el frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddControllers();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Consultorio Médico Luz y Vida API",
        Version = "v1",
        Description = "API para la gestión del Consultorio Médico Luz y Vida - Malchingui"
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Consultorio Luz y Vida API v1");
        options.RoutePrefix = "swagger"; // Cambiado para usar /swagger
        options.DefaultModelsExpandDepth(-1); // Ocultar modelos por defecto
        options.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.None); // Colapsar endpoints por defecto
    });
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("AllowAngular");

// Nota: UseAuthentication() debe ir antes de UseAuthorization()
// Si no tienes autenticación configurada, puedes comentar esta línea
// app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

// Crear la base de datos si no existe
try
{
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<ConsultorioDbContext>();
        context.Database.Migrate();

        if (!context.PlantillasConsulta.Any())
        {
            context.PlantillasConsulta.AddRange(new[]
            {
                new PlantillaConsultaModel
                {
                    PlantillaConsultaId = 1,
                    Nombre = "Consulta general",
                    MotivoConsulta = "Control de rutina",
                    Sintomas = "Paciente refiere malestar general leve",
                    Diagnostico = "Evaluación inicial",
                    Tratamiento = "Recomendaciones generales y reposo",
                    Observaciones = "Registrar signos vitales básicos"
                },
                new PlantillaConsultaModel
                {
                    PlantillaConsultaId = 2,
                    Nombre = "Cuadro respiratorio",
                    MotivoConsulta = "Dolor de garganta y tos",
                    Sintomas = "Tos seca, congestión nasal, fiebre leve",
                    Diagnostico = "Infección de vías respiratorias altas",
                    Tratamiento = "Antitérmicos y reposo hidratación",
                    Observaciones = "Verificar antecedentes de alergias"
                },
                new PlantillaConsultaModel
                {
                    PlantillaConsultaId = 3,
                    Nombre = "Seguimiento crónico",
                    MotivoConsulta = "Control de enfermedad crónica",
                    Sintomas = "Paciente niega síntomas nuevos",
                    Diagnostico = "Seguimiento de condición estable",
                    Tratamiento = "Mantener medicación actual",
                    Observaciones = "Solicitar análisis de laboratorio si corresponde"
                }
            });

            context.SaveChanges();
            Console.WriteLine("Plantillas de consulta iniciales creadas.");
        }

        if (!context.HorariosAtencion.Any())
        {
            var horario = new HorarioAtencionModel
            {
                DiaInicio = DayOfWeek.Monday,
                HoraInicio = new TimeSpan(8, 0, 0),
                DiaFin = DayOfWeek.Friday,
                HoraFin = new TimeSpan(17, 30, 0)
            };

            context.HorariosAtencion.Add(horario);
            context.SaveChanges();
            Console.WriteLine("Horario de atención inicial creado.");
        }

        Console.WriteLine("Base de datos verificada/creada exitosamente.");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Error al crear la base de datos: {ex.Message}");
    // La aplicación continuará ejecutándose, pero sin base de datos
}

Console.WriteLine("Aplicación iniciada. Accede a Swagger en: https://localhost:7037/swagger");

app.Run();
