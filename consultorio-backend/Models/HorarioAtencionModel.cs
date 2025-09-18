using System.ComponentModel.DataAnnotations;

namespace ConsultorioMedico.API.Models
{
    public class HorarioAtencionModel
    {
        [Key]
        public int HorarioAtencionId { get; set; }

        [Required]
        public DayOfWeek DiaSemana { get; set; }

        [Required]
        public TimeSpan HoraInicio { get; set; }

        [Required]
        public TimeSpan HoraFin { get; set; }

        public bool Activo { get; set; } = true;
    }
}
