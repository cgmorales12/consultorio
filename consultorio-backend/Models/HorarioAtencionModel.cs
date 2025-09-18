using System.ComponentModel.DataAnnotations;

namespace ConsultorioMedico.API.Models
{
    public class HorarioAtencionModel
    {
        [Key]
        public int HorarioAtencionId { get; set; }

        [Required]
        public DayOfWeek DiaInicio { get; set; }

        [Required]
        public TimeSpan HoraInicio { get; set; }

        [Required]
        public DayOfWeek DiaFin { get; set; }

        [Required]
        public TimeSpan HoraFin { get; set; }
    }
}
