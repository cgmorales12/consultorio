using ConsultorioMedico.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ConsultorioMedico.API.Data
{
    public class ConsultorioDbContext : DbContext
    {
        public ConsultorioDbContext(DbContextOptions<ConsultorioDbContext> options) : base(options)
        {
        }

        public DbSet<PacienteModel> Pacientes { get; set; }

        public DbSet<HistoriaClinicaModel> HistoriasClinicas { get; set; }

        public DbSet<ConsultaMedicaModel> ConsultasMedicas { get; set; }

        public DbSet<PlantillaConsultaModel> PlantillasConsulta { get; set; }

        public DbSet<CitaModel> Citas { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configuración para Paciente
            modelBuilder.Entity<PacienteModel>(entity =>
            {
                entity.HasIndex(e => e.Cedula).IsUnique();
                entity.Property(e => e.Cedula).IsRequired().HasMaxLength(10);

                entity.HasIndex(e => e.Email).IsUnique();
                entity.Property(e => e.Email).HasMaxLength(100);
            });

            // Configuración para Historias clínicas
            modelBuilder.Entity<HistoriaClinicaModel>(entity =>
            {
                entity.HasIndex(e => e.PacienteId).IsUnique();
                entity.Property(e => e.AntecedentesPersonales).HasMaxLength(2000);
                entity.Property(e => e.AntecedentesFamiliares).HasMaxLength(2000);
                entity.Property(e => e.Vacunas).HasMaxLength(1000);
                entity.Property(e => e.Alergias).HasMaxLength(1000);

                entity.HasOne(e => e.Paciente)
                      .WithMany(p => p.HistoriasClinicas)
                      .HasForeignKey(e => e.PacienteId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Configuración para Consultas médicas
            modelBuilder.Entity<ConsultaMedicaModel>(entity =>
            {
                entity.Property(e => e.MotivoConsulta).IsRequired().HasMaxLength(200);
                entity.Property(e => e.Sintomas).IsRequired().HasMaxLength(2000);
                entity.Property(e => e.Diagnostico).IsRequired().HasMaxLength(2000);
                entity.Property(e => e.Tratamiento).IsRequired().HasMaxLength(2000);
                entity.Property(e => e.Observaciones).HasMaxLength(2000);
                entity.Property(e => e.PesoKg).HasColumnType("decimal(5,2)");
                entity.Property(e => e.EstaturaCm).HasColumnType("decimal(5,2)");
                entity.Property(e => e.TemperaturaC).HasColumnType("decimal(4,1)");
                entity.Property(e => e.Imc).HasColumnType("decimal(5,2)");
                entity.Property(e => e.ClasificacionImc).HasMaxLength(50);

                entity.HasOne(e => e.HistoriaClinica)
                      .WithMany(h => h.Consultas)
                      .HasForeignKey(e => e.HistoriaClinicaId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Configuración para Plantillas de consulta
            modelBuilder.Entity<PlantillaConsultaModel>(entity =>
            {
                entity.Property(e => e.Nombre).IsRequired().HasMaxLength(150);
                entity.Property(e => e.MotivoConsulta).HasMaxLength(200);
                entity.Property(e => e.Sintomas).HasMaxLength(2000);
                entity.Property(e => e.Diagnostico).HasMaxLength(2000);
                entity.Property(e => e.Tratamiento).HasMaxLength(2000);
                entity.Property(e => e.Observaciones).HasMaxLength(2000);
            });

            // Configuración para Citas médicas
            modelBuilder.Entity<CitaModel>(entity =>
            {
                entity.Property(e => e.Motivo).HasMaxLength(500);
                entity.Property(e => e.Notas).HasMaxLength(1000);
                entity.Property(e => e.HoraInicio).HasColumnType("time");
                entity.Property(e => e.HoraFin).HasColumnType("time");
                entity.Property(e => e.Estado)
                      .HasConversion<string>()
                      .HasMaxLength(20);

                entity.HasOne(e => e.Paciente)
                      .WithMany(p => p.Citas)
                      .HasForeignKey(e => e.PacienteId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Datos iniciales de prueba
            modelBuilder.Entity<PacienteModel>().HasData(
                new PacienteModel
                {
                    PacienteId = 1,
                    Cedula = "1720548963",
                    Nombres = "Juan Carlos",
                    Apellidos = "Pérez González",
                    FechaNacimiento = new DateTime(1985, 5, 15),
                    Genero = "M",
                    Direccion = "Malchingui, Calle Principal 123",
                    Telefono = "062345678",
                    Celular = "0987654321",
                    Email = "juan.perez@email.com",
                    EstadoCivil = "Casado",
                    Ocupacion = "Agricultor",
                    TipoSangre = "O+",
                    Estado = true,
                    FechaRegistro = DateTime.Now
                },
                new PacienteModel
                {
                    PacienteId = 2,
                    Cedula = "1720548964",
                    Nombres = "María Elena",
                    Apellidos = "García López",
                    FechaNacimiento = new DateTime(1990, 8, 22),
                    Genero = "F",
                    Direccion = "Malchingui, Barrio Central",
                    Telefono = "062345679",
                    Celular = "0987654322",
                    Email = "maria.garcia@email.com",
                    EstadoCivil = "Soltera",
                    Ocupacion = "Profesora",
                    TipoSangre = "A+",
                    Estado = true,
                    FechaRegistro = DateTime.Now
                }
            );

            modelBuilder.Entity<HistoriaClinicaModel>().HasData(
                new HistoriaClinicaModel
                {
                    HistoriaClinicaId = 1,
                    PacienteId = 1,
                    AntecedentesPersonales = "Cirugía de apéndice en 2010. Control regular de presión arterial.",
                    AntecedentesFamiliares = "Padre con hipertensión. Madre con diabetes tipo II.",
                    Vacunas = "COVID-19 (2023), Influenza (2024)",
                    Alergias = "Penicilina",
                    FechaCreacion = new DateTime(2024, 1, 10),
                    UltimaActualizacion = new DateTime(2024, 5, 10)
                }
            );

            modelBuilder.Entity<ConsultaMedicaModel>().HasData(
                new ConsultaMedicaModel
                {
                    ConsultaMedicaId = 1,
                    HistoriaClinicaId = 1,
                    FechaConsulta = new DateTime(2024, 2, 5),
                    MotivoConsulta = "Control anual de salud",
                    Sintomas = "Paciente asintomático. Revisar resultados de exámenes de rutina.",
                    Diagnostico = "Paciente estable, recomendaciones de actividad física moderada.",
                    Tratamiento = "Mantener dieta balanceada, ejercicios 3 veces por semana.",
                    Observaciones = "Continuar con controles semestrales.",
                    PesoKg = 72.5m,
                    EstaturaCm = 178m,
                    TemperaturaC = 36.6m,
                    FrecuenciaCardiaca = 72,
                    PresionSistolica = 118,
                    PresionDiastolica = 76,
                    Imc = 22.88m,
                    ClasificacionImc = "Normal"
                },
                new ConsultaMedicaModel
                {
                    ConsultaMedicaId = 2,
                    HistoriaClinicaId = 1,
                    FechaConsulta = new DateTime(2024, 5, 10),
                    MotivoConsulta = "Dolor lumbar leve",
                    Sintomas = "Molestia lumbar después de jornadas prolongadas de trabajo.",
                    Diagnostico = "Lumbalgia mecánica leve.",
                    Tratamiento = "Ejercicios de estiramiento, analgésico según dolor.",
                    Observaciones = "Reevaluar en 4 semanas.",
                    PesoKg = 74m,
                    EstaturaCm = 178m,
                    TemperaturaC = 37.9m,
                    FrecuenciaCardiaca = 90,
                    PresionSistolica = 132,
                    PresionDiastolica = 86,
                    Imc = 23.37m,
                    ClasificacionImc = "Normal"
                }
            );

            modelBuilder.Entity<PlantillaConsultaModel>().HasData(
                new PlantillaConsultaModel
                {
                    PlantillaConsultaId = 1,
                    Nombre = "Control general",
                    MotivoConsulta = "Control preventivo",
                    Sintomas = "Revisión integral, sin síntomas específicos",
                    Diagnostico = "Paciente estable",
                    Tratamiento = "Recomendaciones generales de estilo de vida",
                    Observaciones = "Solicitar exámenes básicos anuales"
                },
                new PlantillaConsultaModel
                {
                    PlantillaConsultaId = 2,
                    Nombre = "Atención respiratoria",
                    MotivoConsulta = "Cuadro respiratorio agudo",
                    Sintomas = "Tos, congestión nasal, dolor de garganta",
                    Diagnostico = "Infección respiratoria alta",
                    Tratamiento = "Reposo, hidratación y monitoreo de temperatura",
                    Observaciones = "Indicar alarma por dificultad respiratoria"
                },
                new PlantillaConsultaModel
                {
                    PlantillaConsultaId = 3,
                    Nombre = "Seguimiento crónico",
                    MotivoConsulta = "Control de condición crónica",
                    Sintomas = "Evaluación de signos vitales y adherencia a medicación",
                    Diagnostico = "Seguimiento de condición crónica estable",
                    Tratamiento = "Mantener medicación actual, ajustes según resultados",
                    Observaciones = "Registrar presión arterial y glicemia"
                }
            );

            modelBuilder.Entity<CitaModel>().HasData(
                new CitaModel
                {
                    CitaId = 1,
                    PacienteId = 1,
                    Fecha = new DateTime(2024, 10, 1),
                    HoraInicio = new TimeSpan(9, 0, 0),
                    HoraFin = new TimeSpan(9, 30, 0),
                    Estado = EstadoCita.Programada,
                    Motivo = "Control general",
                    Notas = "Traer resultados de laboratorio",
                    FechaCreacion = new DateTime(2024, 9, 15, 9, 30, 0)
                },
                new CitaModel
                {
                    CitaId = 2,
                    PacienteId = 2,
                    Fecha = new DateTime(2024, 10, 1),
                    HoraInicio = new TimeSpan(10, 0, 0),
                    HoraFin = new TimeSpan(10, 30, 0),
                    Estado = EstadoCita.Confirmada,
                    Motivo = "Evaluación respiratoria",
                    Notas = "Paciente refiere tos persistente",
                    FechaCreacion = new DateTime(2024, 9, 18, 11, 0, 0)
                },
                new CitaModel
                {
                    CitaId = 3,
                    PacienteId = 1,
                    Fecha = new DateTime(2024, 10, 2),
                    HoraInicio = new TimeSpan(14, 0, 0),
                    HoraFin = new TimeSpan(14, 45, 0),
                    Estado = EstadoCita.EnCurso,
                    Motivo = "Control de presión arterial",
                    Notas = "Revisión de medicamento antihipertensivo",
                    FechaCreacion = new DateTime(2024, 9, 25, 8, 15, 0)
                }
            );
        }
    }
}
