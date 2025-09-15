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
        }
    }
}
